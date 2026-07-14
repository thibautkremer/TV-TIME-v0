'use strict';
// ============================================================
// ADMIN — MAJ de masse API et gestion des liens Movix
// ============================================================

async function migrateToTmdbIds() {
    console.log("Migration TMDB déjà effectuée.");
}

async function massUpdateLibrary(type, silent = false) {
    const btnId = type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie';
    const btn = document.getElementById(btnId);
    const originalContent = btn ? btn.innerHTML : '';

    if (!silent && btn) {
        document.getElementById('btn-mass-update-series').disabled = true;
        document.getElementById('btn-mass-update-movie').disabled = true;
    }

    let updatedCount = 0; let skippedCount = 0; let errorCount = 0;
    const itemsToProcess = library.filter(i => i.type === type);

    for (let i = 0; i < itemsToProcess.length; i++) {
        let item = itemsToProcess[i];
        let updates = [];

        if (!silent && btn) btn.innerHTML = `<span class="truncate w-full text-center px-1">⏳ [${i + 1}/${itemsToProcess.length}] ${item.title}</span>`;

        try {
            let changed = false; let data = null;

            if (item.type === 'series') {
                const res = await fetch(`${TMDB_BASE}/tv/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
                if (!res.ok) throw new Error(`TMDB API Error`);
                data = await res.json();

                const r = data.episode_run_time?.length ? data.episode_run_time[0] : item.runtime; 
                if (item.runtime !== r) { item.runtime = r; changed = true; updates.push("Durée"); }
                if (data.poster_path && item.image !== `https://image.tmdb.org/t/p/w500${data.poster_path}`) { item.image = `https://image.tmdb.org/t/p/w500${data.poster_path}`; changed = true; updates.push("Affiche"); }
                if (data.overview && item.summary !== data.overview) { item.summary = data.overview; changed = true; updates.push("Résumé"); }
                
                let mappedStatus = item.status_production;
                if (data.status === 'Ended') mappedStatus = 'Ended';
                else if (data.status === 'Canceled') mappedStatus = 'Canceled';
                else if (data.status === 'Returning Series') mappedStatus = 'Running';

                if (item.status_production !== mappedStatus) { item.status_production = mappedStatus; changed = true; updates.push("Status"); }
                
                const net = data.networks?.length ? data.networks[0].name : item.network; 
                if (net && item.network !== net) { item.network = net; changed = true; updates.push("Plateforme"); }
                
                const allTmdbEps = await fetchAllTmdbEpisodes(item.apiId);
                let newEpsAdded = 0;
                
                allTmdbEps.forEach(apiEp => {
                    const existingEp = item.episodes.find(e => String(e.id) === String(apiEp.id) || (e.season === apiEp.season && e.number === apiEp.number));
                    if (!existingEp) { 
                        item.episodes.push({ ...apiEp, watched: false }); 
                        newEpsAdded++; 
                        changed = true; 
                    } else {
                        if (String(existingEp.id) !== String(apiEp.id)) { existingEp.id = apiEp.id; changed = true; }
                        if (existingEp.name !== apiEp.name) { existingEp.name = apiEp.name; changed = true; }
                        if (existingEp.summary !== apiEp.summary) { existingEp.summary = apiEp.summary; changed = true; }
                    }
                });
                if (newEpsAdded > 0) updates.push(`+${newEpsAdded} épisodes`);
                
            } else if (item.type === 'movie') {
                const res = await fetch(`${TMDB_BASE}/movie/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
                if (res.ok) {
                    data = await res.json();
                    if (data.runtime && item.runtime !== data.runtime) { item.runtime = data.runtime; changed = true; updates.push("Durée"); }
                    if (data.poster_path && item.image !== `https://image.tmdb.org/t/p/w500${data.poster_path}`) { item.image = `https://image.tmdb.org/t/p/w500${data.poster_path}`; changed = true; updates.push("Affiche"); }
                    if (data.overview && item.summary !== data.overview) { item.summary = data.overview; changed = true; updates.push("Résumé"); }
                }
            }

            if (changed) {
                item.last_modified = Date.now();
                await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: item.id, media_data: item, last_modified: item.last_modified }, { onConflict: 'user_id,media_id' });
                saveLocalDB(); updatedCount++;
            } else { skippedCount++; }
        } catch (e) { errorCount++; }
        await new Promise(r => setTimeout(r, 400));
    }

    if (!silent) {
        localStorage.setItem('last_mass_update_time', Date.now().toString());
        if (btn) btn.innerHTML = originalContent;
        document.getElementById('btn-mass-update-series').disabled = false;
        document.getElementById('btn-mass-update-movie').disabled = false;
        alert(`Bilan (${type}) :\n✅ ${updatedCount} mis à jour\n➖ ${skippedCount} OK\n❌ ${errorCount} erreurs.`);
        location.reload();
    }
}

function toggleMovixManager() { const section = document.getElementById('movixManagerSection'); section.classList.toggle('hidden'); if (!section.classList.contains('hidden')) renderMovixManager(); }
function renderMovixManager() { const body = document.getElementById('movixManagerBody'); body.innerHTML = ''; library.filter(m => m.status !== 'Watched').forEach(m => { const displayTitle = m.title_fr || m.title; const row = document.createElement('tr'); row.innerHTML = `<td class="py-2 truncate max-w-[120px] text-gray-300 font-bold" title="${displayTitle}">${displayTitle}</td><td class="py-2"><input type="text" data-id="${m.id}" value="${m.movixUrl || ''}" placeholder="https://movix.cash/..." class="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-full text-[10px] text-white"></td>`; body.appendChild(row); }); }
async function saveAllMovixUrls() { const inputs = document.querySelectorAll('#movixManagerBody input'); const updates = []; inputs.forEach(input => { const id = input.getAttribute('data-id'); const url = input.value.trim(); const media = library.find(m => m.id === id); if (media) { media.movixUrl = url; media.last_modified = Date.now(); updates.push(media); } }); saveLocalDB(); if (updates.length > 0) { await supabaseClient.from('user_library').upsert(updates.map(m => ({ user_id: localUserId, media_id: m.id, media_data: m, last_modified: m.last_modified })), { onConflict: 'user_id,media_id' }); } alert("URLs sauvegardées !"); toggleMovixManager(); }
