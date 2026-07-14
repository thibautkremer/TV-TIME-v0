'use strict';
// ============================================================
// ADMIN — MAJ de masse API 100% TMDB
// ============================================================

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
    const totalItems = itemsToProcess.length;

    for (let i = 0; i < totalItems; i++) {
        let item = itemsToProcess[i];
        
        // Mise à jour du libellé du bouton pour voir l'avancement
        if (!silent && btn) {
            btn.innerHTML = `<span class="truncate w-full text-center px-1">⏳ [${i + 1}/${totalItems}] ${item.title_fr || item.title}</span>`;
        }
        
        console.log(`[MAJ] (${i + 1}/${totalItems}) Traitement de : ${item.title_fr || item.title}`);

        try {
            let changed = false; 
            const res = await fetch(`${TMDB_BASE}/${type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`);
            if (!res.ok) throw new Error(`TMDB API Error`);
            const data = await res.json();

            // Plateformes films
            if (type === 'movie' && data['watch/providers']) {
                const prov = data['watch/providers'].results?.FR?.flatrate?.[0]?.provider_name;
                if (prov && item.network !== prov) { item.network = prov; changed = true; }
            }

            // Mise à jour générique
            if (data.overview && item.summary !== data.overview) { item.summary = data.overview; changed = true; }
            if (data.poster_path && item.image !== `https://image.tmdb.org/t/p/w500${data.poster_path}`) { item.image = `https://image.tmdb.org/t/p/w500${data.poster_path}`; changed = true; }

            // Notes de tous les épisodes
            if (type === 'series') {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                item.episodes.forEach(ep => {
                    const freshEp = allEps.find(e => e.season === ep.season && e.number === ep.number);
                    if (freshEp && freshEp.rating !== ep.rating) { 
                        ep.rating = freshEp.rating; 
                        changed = true; 
                    }
                });
            }

            if (changed) {
                console.log(`✅ ${item.title_fr || item.title} mis à jour.`);
                item.last_modified = Date.now();
                await saveLocalDB(item);
                updatedCount++;
            } else {
                console.log(`➖ ${item.title_fr || item.title} : aucune mise à jour nécessaire.`);
                skippedCount++;
            }
        } catch (e) { 
            console.error(`❌ Erreur lors du traitement de ${item.title_fr || item.title}`, e); 
            errorCount++; 
        }
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
