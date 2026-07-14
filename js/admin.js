'use strict';
// ============================================================
// ADMIN — MAJ de masse API et gestion des liens Movix
// ============================================================

async function massUpdateLibrary(type, silent = false) {
    const btnId = type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie'; 
    const btn = document.getElementById(btnId); 
    const originalContent = btn ? btn.innerHTML : '';
    
    if (!silent && btn) { 
        document.getElementById('btn-mass-update-series').disabled = true; 
        document.getElementById('btn-mass-update-movie').disabled = true; 
    }
    
    const sanitizePlatform = (p) => { if (!p || p === 'N/A' || p.toLowerCase().includes('trakt')) return 'Theater'; return p; };
    let updatedCount = 0; let skippedCount = 0; let errorCount = 0; 
    const itemsToProcess = library.filter(i => i.type === type);

    for (let i = 0; i < itemsToProcess.length; i++) {
        let item = itemsToProcess[i]; 
        let updates = [];
        
        if (!silent && btn) btn.innerHTML = `<span class="truncate w-full text-center px-1">⏳ [${i + 1}/${itemsToProcess.length}] ${item.title}</span>`;

        try {
            let changed = false; let data = null;

            // --- CORRECTION : Résolution forcée des IDs ---
            if (String(item.apiId).startsWith('tt')) {
                if (item.type === 'series') {
                    await resolveSeriesFromImdb(item); // Utilise la fonction existante dans api.js qui réécrit l'apiId
                } else {
                    await resolveMovieFromTmdb(item); // Idem pour les films[cite: 8]
                }
                changed = true;
            }
            // ----------------------------------------------

            if (item.type === 'series') {
                try { 
                    const akaRes = await fetch(`https://api.tvmaze.com/shows/${item.apiId}/akas`); 
                    if (akaRes.ok) { 
                        const akas = await akaRes.json(); 
                        const frAka = akas.find(a => a.country?.code === 'FR'); 
                        if (frAka && item.title_fr !== frAka.name) { item.title_fr = frAka.name; changed = true; } 
                    } 
                } catch (e) {}
                
                const res = await fetch(`https://api.tvmaze.com/shows/${item.apiId}?embed=episodes`); 
                if (!res.ok) throw new Error(`TVMaze API Error`); 
                data = await res.json();

                // ... (reste de ta logique de mise à jour existante)[cite: 7]
                if (data.runtime || data.averageRuntime) { const r = data.runtime || data.averageRuntime; if (item.runtime !== r) { item.runtime = r; changed = true; } }
                if (data.image?.medium && item.image !== data.image.medium) { item.image = data.image.medium; changed = true; }
                if (data.summary && item.summary !== data.summary.replace(/<[^>]*>/g, '')) { item.summary = data.summary.replace(/<[^>]*>/g, ''); changed = true; }
                let newStatus = data.status; if (data.summary && /cancel/i.test(data.summary)) newStatus = 'Canceled';
                if (newStatus && item.status_production !== newStatus) { item.status_production = newStatus; changed = true; }
                const net = sanitizePlatform(data.network?.name || data.webChannel?.name); if (net && item.network !== net) { item.network = net; changed = true; }

                // Mise à jour épisodes...[cite: 7]
                if (data._embedded?.episodes) {
                    // ... (logique épisodes identique)[cite: 7]
                }
            }
            else if (item.type === 'movie') {
                // ... (logique movie existante)[cite: 7]
                const res = await fetch(`${TMDB_BASE}/movie/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`); 
                if (res.ok) data = await res.json();
                if (!data || data.success === false) throw new Error(`Non trouvé`);
                // ... (mise à jour champs)[cite: 7]
            }

            if (changed) { 
                item.last_modified = Date.now(); 
                await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: item.id, media_data: item, last_modified: item.last_modified }, { onConflict: 'user_id,media_id' }); 
                saveLocalDB(); 
                updatedCount++; 
            } else { 
                skippedCount++; 
            }
        } catch (e) { errorCount++; }
        await new Promise(r => setTimeout(r, 800));
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
