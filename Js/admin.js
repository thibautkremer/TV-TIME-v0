'use strict';
// ============================================================
// ADMIN — MAJ de masse API et gestion des liens Movix
// ============================================================

async function massUpdateLibrary(type, silent = false) {
    const btnId = type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie'; const btn = document.getElementById(btnId); const originalContent = btn ? btn.innerHTML : '';
    if (!silent && btn) { document.getElementById('btn-mass-update-series').disabled = true; document.getElementById('btn-mass-update-movie').disabled = true; }
    const sanitizePlatform = (p) => { if (!p || p === 'N/A' || p.toLowerCase().includes('trakt')) return 'Theater'; return p; };
    let updatedCount = 0; let skippedCount = 0; let errorCount = 0; const itemsToProcess = library.filter(i => i.type === type);

    for (let i = 0; i < itemsToProcess.length; i++) {
        let item = itemsToProcess[i]; let updates = [];
        if (!silent && btn) btn.innerHTML = `<span class="truncate w-full text-center px-1">⏳ [${i + 1}/${itemsToProcess.length}] ${item.title}</span>`;

        try {
            let changed = false; let data = null;
            if (item.type === 'series' && item.apiId) {
                try { const akaRes = await fetch(`https://api.tvmaze.com/shows/${item.apiId}/akas`); if (akaRes.ok) { const akas = await akaRes.json(); const frAka = akas.find(a => a.country?.code === 'FR'); if (frAka && item.title_fr !== frAka.name) { item.title_fr = frAka.name; changed = true; updates.push("Titre FR"); } } } catch (e) {}
                const res = await fetch(`https://api.tvmaze.com/shows/${item.apiId}?embed=episodes`); if (!res.ok) throw new Error(`TVMaze API Error`); data = await res.json();

                if (data.runtime || data.averageRuntime) { const r = data.runtime || data.averageRuntime; if (item.runtime !== r) { item.runtime = r; changed = true; updates.push("Durée"); } }
                if (data.image?.medium && item.image !== data.image.medium) { item.image = data.image.medium; changed = true; updates.push("Affiche"); }
                if (data.summary && item.summary !== data.summary.replace(/<[^>]*>/g, '')) { item.summary = data.summary.replace(/<[^>]*>/g, ''); changed = true; updates.push("Résumé"); }
                let newStatus = data.status; if (data.summary && /cancel/i.test(data.summary)) newStatus = 'Canceled';
                if (newStatus && item.status_production !== newStatus) { item.status_production = newStatus; changed = true; updates.push("Status"); }
                const net = sanitizePlatform(data.network?.name || data.webChannel?.name); if (net && item.network !== net) { item.network = net; changed = true; updates.push("Plateforme"); }

                let foundAnyEpisodeRating = false; const seriesRating = data.rating?.average || 0;
                if (data._embedded?.episodes) {
                    if (!item.episodes) item.episodes = []; const existingEpIds = new Set(item.episodes.map(e => e.id)); let newEpsAdded = 0;
                    data._embedded.episodes.forEach(apiEp => {
                        if (existingEpIds.has(apiEp.id)) {
                            const localEp = item.episodes.find(e => e.id === apiEp.id); const newR = apiEp.rating?.average || 0; if (newR > 0) foundAnyEpisodeRating = true;
                            const newS = apiEp.summary ? apiEp.summary.replace(/<[^>]*>/g, '') : ''; const newRun = apiEp.runtime || 0;
                            if (localEp.rating !== newR || localEp.summary !== newS || localEp.runtime !== newRun) { localEp.rating = newR; localEp.summary = newS; localEp.runtime = newRun; changed = true; }
                        } else {
                            item.episodes.push({ id: apiEp.id, season: apiEp.season, number: apiEp.number, name: apiEp.name, airdate: apiEp.airdate, runtime: apiEp.runtime, rating: apiEp.rating?.average || 0, watched: false });
                            newEpsAdded++; changed = true;
                        }
                    });
                    if (newEpsAdded > 0) { updates.push(`+${newEpsAdded} épisodes`); item.status = item.episodes.every(e => e.watched || !e.airdate || e.airdate > todayString) ? 'Watched' : 'In Progress'; item.episodes.sort((a, b) => { if (a.season !== b.season) return a.season - b.season; return a.number - b.number; }); }
                }
                if (!foundAnyEpisodeRating && seriesRating > 0) { item.episodes.forEach(e => { if (e.rating !== seriesRating) { e.rating = seriesRating; changed = true; } }); if (item.rating !== seriesRating) { item.rating = seriesRating; changed = true; } }
                else if (data.rating?.average && item.rating !== data.rating.average) { item.rating = data.rating.average; changed = true; updates.push("Note"); }
            }
            else if (item.type === 'movie') {
                let attemptData = null;
                if (item.apiId && !String(item.apiId).startsWith('tt')) {
                    const res = await fetch(`${TMDB_BASE}/movie/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`); if (res.ok) attemptData = await res.json();
                } else {
                    const res = await fetch(`${TMDB_BASE}/find/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&external_source=imdb_id`);
                    if (res.ok) { const findData = await res.json(); if (findData.movie_results?.length > 0) { item.apiId = findData.movie_results[0].id; const res2 = await fetch(`${TMDB_BASE}/movie/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`); if (res2.ok) attemptData = await res2.json(); } }
                    if (!attemptData) { const res3 = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(item.title)}`); if (res3.ok) { const searchData = await res3.json(); if (searchData.results?.length > 0) { item.apiId = searchData.results[0].id; const res4 = await fetch(`${TMDB_BASE}/movie/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`); if (res4.ok) attemptData = await res4.json(); } } }
                }
                data = attemptData; if (!data || data.success === false) throw new Error(`Non trouvé`);

                if (data.runtime) { if (item.runtime !== data.runtime) { item.runtime = data.runtime; changed = true; updates.push("Durée"); } }
                if (data.poster_path) { const newImg = `https://image.tmdb.org/t/p/w500${data.poster_path}`; if (item.image !== newImg) { item.image = newImg; changed = true; updates.push("Affiche"); } }
                if (data.overview && item.summary !== data.overview) { item.summary = data.overview; changed = true; updates.push("Résumé"); }
                if (data.genres) { const newGenres = data.genres.map(g => g.name); if (JSON.stringify(item.genres) !== JSON.stringify(newGenres)) { item.genres = newGenres; changed = true; updates.push("Genres"); } }
                const prod = sanitizePlatform(data.production_companies?.length > 0 ? data.production_companies[0].name : ''); if (prod && item.network !== prod) { item.network = prod; changed = true; updates.push("Plateforme"); }
                if (data.vote_average && item.rating !== data.vote_average) { item.rating = data.vote_average; changed = true; updates.push("Note"); }
                if (data.title && item.title_fr !== data.title) { item.title_fr = data.title; changed = true; updates.push("Titre FR"); }
                if (data.release_date && item.releaseDate !== data.release_date) { item.releaseDate = data.release_date; changed = true; }
            }
            if (changed) { item.last_modified = Date.now(); await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: item.id, media_data: item, last_modified: item.last_modified }, { onConflict: 'user_id,media_id' }); saveLocalDB(); updatedCount++; } else { skippedCount++; }
        } catch (e) { errorCount++; }
        await new Promise(r => setTimeout(r, 800));
    }

    if (!silent) {
        localStorage.setItem('last_mass_update_time', Date.now().toString()); if (btn) btn.innerHTML = originalContent; document.getElementById('btn-mass-update-series').disabled = false; document.getElementById('btn-mass-update-movie').disabled = false;
        alert(`Bilan (${type}) :\n✅ ${updatedCount} mis à jour\n➖ ${skippedCount} OK\n❌ ${errorCount} erreurs.`); location.reload();
    }
}

function toggleMovixManager() { const section = document.getElementById('movixManagerSection'); section.classList.toggle('hidden'); if (!section.classList.contains('hidden')) renderMovixManager(); }

function renderMovixManager() {
    const body = document.getElementById('movixManagerBody'); body.innerHTML = '';
    library.filter(m => m.status !== 'Watched').forEach(m => {
        const displayTitle = m.title_fr || m.title; const row = document.createElement('tr');
        row.innerHTML = `<td class="py-2 truncate max-w-[120px] text-gray-300 font-bold" title="${displayTitle}">${displayTitle}</td><td class="py-2"><input type="text" data-id="${m.id}" value="${m.movixUrl || ''}" placeholder="https://movix.cash/..." class="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-full text-[10px] text-white"></td>`;
        body.appendChild(row);
    });
}

async function saveAllMovixUrls() {
    const inputs = document.querySelectorAll('#movixManagerBody input'); const updates = [];
    inputs.forEach(input => { const id = input.getAttribute('data-id'); const url = input.value.trim(); const media = library.find(m => m.id === id); if (media) { media.movixUrl = url; media.last_modified = Date.now(); updates.push(media); } });
    saveLocalDB();
    if (updates.length > 0) { await supabaseClient.from('user_library').upsert(updates.map(m => ({ user_id: localUserId, media_id: m.id, media_data: m, last_modified: m.last_modified })), { onConflict: 'user_id,media_id' }); }
    alert("URLs sauvegardées et synchronisées !"); toggleMovixManager();
}
