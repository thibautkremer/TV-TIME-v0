'use strict';
// ============================================================
// ADMIN — MAJ de masse API et gestion des liens Movix
// ============================================================
// A COLLER TEMPORAIREMENT DANS admin.js
async function migrateToTmdbIds() {
    console.log("%c[Migration TMDB] Démarrage...", "color: #eab308; font-weight: bold; font-size: 14px;");
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < library.length; i++) {
        let item = library[i];
        let oldId = item.apiId;
        let newTmdbId = null;

        console.log(`Traitement [${i+1}/${library.length}] : ${item.title} (Ancien ID: ${oldId})`);

        try {
            if (item.type === 'series') {
                // Pour les séries, on fait une recherche par titre et année pour être précis
                const cleanTitle = (item.title_fr || item.title).split('(')[0].trim();
                let searchUrl = `${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(cleanTitle)}`;
                
                // Si on a l'année de sortie, on l'utilise pour filtrer et éviter les doublons
                if (item.premiered) {
                    const year = item.premiered.split('-')[0];
                    searchUrl += `&first_air_date_year=${year}`;
                }

                const res = await fetch(searchUrl);
                const data = await res.json();

                if (data.results && data.results.length > 0) {
                    newTmdbId = data.results[0].id;
                }
            } 
            else if (item.type === 'movie') {
                // Pour les films, si l'ID commence par 'tt' (OMDB), on utilise le /find de TMDB
                if (String(oldId).startsWith('tt')) {
                    const res = await fetch(`${TMDB_BASE}/find/${oldId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
                    const data = await res.json();
                    if (data.movie_results && data.movie_results.length > 0) {
                        newTmdbId = data.movie_results[0].id;
                    }
                } else {
                    // C'est probablement déjà un ID TMDB
                    newTmdbId = oldId; 
                }
            }

            // Si on a trouvé le nouvel ID et qu'il est différent de l'ancien
            if (newTmdbId && String(newTmdbId) !== String(oldId)) {
                item.apiId = newTmdbId;
                item.last_modified = Date.now();
                
                // Sauvegarde dans Supabase
                await supabaseClient.from('user_library')
                    .upsert({ user_id: localUserId, media_id: item.id, media_data: item, last_modified: item.last_modified }, { onConflict: 'user_id,media_id' });
                
                console.log(`%c  ✅ Succès : ${oldId} -> ${newTmdbId}`, "color: #22c55e;");
                successCount++;
            } else {
                console.log(`  ➖ Inchangé ou non trouvé.`);
            }

        } catch (e) {
            console.error(`  ❌ Erreur sur ${item.title}:`, e);
            errorCount++;
        }

        // Pause pour ne pas spammer l'API TMDB (50 requêtes/seconde autorisées, on est larges, mais on reste prudents)
        await new Promise(r => setTimeout(r, 200));
    }

    saveLocalDB(); // Sauvegarde locale finale
    console.log(`%c[Migration TMDB] Terminée ! ✅ ${successCount} IDs mis à jour, ❌ ${errorCount} erreurs.`, "color: #eab308; font-weight: bold; font-size: 14px;");
    alert(`Migration terminée !\n${successCount} IDs mis à jour.\nRecharge la page.`);
}

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

    console.log(`%c[MassUpdate] Début du traitement pour : ${type} (${itemsToProcess.length} éléments)`, "color: #0D9488; font-weight: bold;");

    for (let i = 0; i < itemsToProcess.length; i++) {
        let item = itemsToProcess[i];
        let updates = [];

        console.log(`%c[${i + 1}/${itemsToProcess.length}] Traitement de : ${item.title}`, "color: #94a3b8;");

        if (!silent && btn) btn.innerHTML = `<span class="truncate w-full text-center px-1">⏳ [${i + 1}/${itemsToProcess.length}] ${item.title}</span>`;

        try {
            let changed = false; let data = null;

            // --- Résolution forcée des IDs ---
            if (String(item.apiId).startsWith('tt')) {
                console.log(`  └─ ID OMDB détecté (${item.apiId}), résolution TMDB/TVMaze...`);
                if (item.type === 'series') await resolveSeriesFromImdb(item);
                else await resolveMovieFromTmdb(item);
                changed = true;
                updates.push("Résolution ID");
            }

            if (item.type === 'series') {
                try {
                    const akaRes = await fetch(`https://api.tvmaze.com/shows/${item.apiId}/akas`);
                    if (akaRes.ok) {
                        const akas = await akaRes.json();
                        const frAka = akas.find(a => a.country?.code === 'FR');
                        if (frAka && item.title_fr !== frAka.name) { item.title_fr = frAka.name; changed = true; updates.push("Titre FR"); }
                    }
                } catch (e) {}

                const res = await fetch(`https://api.tvmaze.com/shows/${item.apiId}?embed=episodes`);
                if (!res.ok) throw new Error(`TVMaze API Error`);
                data = await res.json();

                if (data.runtime || data.averageRuntime) { const r = data.runtime || data.averageRuntime; if (item.runtime !== r) { item.runtime = r; changed = true; updates.push("Durée"); } }
                if (data.image?.medium && item.image !== data.image.medium) { item.image = data.image.medium; changed = true; updates.push("Affiche"); }
                if (data.summary && item.summary !== data.summary.replace(/<[^>]*>/g, '')) { item.summary = data.summary.replace(/<[^>]*>/g, ''); changed = true; updates.push("Résumé"); }
                
                let newStatus = data.status; if (data.summary && /cancel/i.test(data.summary)) newStatus = 'Canceled';
                if (newStatus && item.status_production !== newStatus) { item.status_production = newStatus; changed = true; updates.push("Status"); }
                const net = sanitizePlatform(data.network?.name || data.webChannel?.name); if (net && item.network !== net) { item.network = net; changed = true; updates.push("Plateforme"); }
                
                // Gestion épisodes
                if (data._embedded?.episodes) {
                    let newEpsAdded = 0;
                    data._embedded.episodes.forEach(apiEp => {
                        const existingEp = item.episodes.find(e => e.id === apiEp.id);
                        if (!existingEp) { item.episodes.push({ id: apiEp.id, season: apiEp.season, number: apiEp.number, name: apiEp.name, airdate: apiEp.airdate, runtime: apiEp.runtime, rating: apiEp.rating?.average || 0, watched: false }); newEpsAdded++; changed = true; }
                    });
                    if (newEpsAdded > 0) updates.push(`+${newEpsAdded} épisodes`);
                }
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
                saveLocalDB();
                updatedCount++;
                console.log(`%c  ✅ Mise à jour effectuée : ${updates.join(', ')}`, "color: #22c55e;");
            } else {
                skippedCount++;
                console.log(`  ➖ Aucune mise à jour nécessaire.`);
            }
        } catch (e) {
            errorCount++;
            console.error(`  ❌ Erreur lors du traitement de ${item.title} :`, e);
        }
        await new Promise(r => setTimeout(r, 800));
    }

    console.log(`%c[MassUpdate] Terminé pour ${type} !`, "color: #0D9488; font-weight: bold;");

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
