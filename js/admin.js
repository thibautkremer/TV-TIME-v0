'use strict';
// ============================================================
// ADMIN — MAJ de masse API 100% TMDB
// ============================================================

async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const originalContent = btn ? btn.innerHTML : '';
    
    // Filtrage des éléments par type
    const itemsToProcess = library.filter(i => i.type === type);
    const total = itemsToProcess.length;

    if (total === 0) {
        alert("Aucun média à mettre à jour.");
        return;
    }

    if (!silent && btn) {
        document.getElementById('btn-mass-update-series').disabled = true;
        document.getElementById('btn-mass-update-movie').disabled = true;
    }

    let updatedCount = 0;

    for (let i = 0; i < total; i++) {
        let item = itemsToProcess[i];
        
        // Mise à jour de l'UI pour voir l'avancement
        if (!silent && btn) {
            btn.innerHTML = `⏳ [${i + 1}/${total}] ${item.title_fr || item.title}`;
        }
        
        console.log(`[MAJ] (${i + 1}/${total}) Traitement de : ${item.title_fr || item.title}`);

        try {
            const res = await fetch(`${TMDB_BASE}/${type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`);
            if (!res.ok) throw new Error(`Erreur API TMDB`);
            const data = await res.json();
            
            let changed = false;

            // 1. Mise à jour Plateforme (Film uniquement)
            if (type === 'movie' && data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) {
                const prov = data['watch/providers'].results.FR.flatrate[0].provider_name;
                if (item.network !== prov) { item.network = prov; changed = true; }
            }

            // 2. Mise à jour Résumé et Affiche (si différents)
            if (data.overview && item.summary !== data.overview) { item.summary = data.overview; changed = true; }
            if (data.poster_path && item.image !== `https://image.tmdb.org/t/p/w500${data.poster_path}`) { 
                item.image = `https://image.tmdb.org/t/p/w500${data.poster_path}`; 
                changed = true; 
            }

            // 3. Mise à jour Notes de TOUS les épisodes (Série uniquement)
            if (type === 'series' && item.episodes) {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                if (allEps.length > 0) {
                    item.episodes.forEach(ep => {
                        const fresh = allEps.find(e => e.season === ep.season && e.number === ep.number);
                        if (fresh) {
                            if (fresh.rating !== ep.rating) { 
                                ep.rating = fresh.rating; 
                                changed = true; 
                            }
                            if (fresh.summary !== ep.summary) {
                                ep.summary = fresh.summary;
                                changed = true;
                            }
                        }
                    });
                    
                    // Recalcul de la note moyenne globale de la série
                    const newAvg = computeAvgEpisodeRating(item.episodes);
                    if (item.rating !== newAvg) {
                        item.rating = newAvg;
                        changed = true;
                    }
                }
            } else if (type === 'movie' && data.vote_average) {
                if (item.rating !== data.vote_average) {
                    item.rating = data.vote_average;
                    changed = true;
                }
            }

            if (changed) {
                item.last_modified = Date.now();
                await saveLocalDB(item);
                updatedCount++;
                console.log(`✅ ${item.title_fr || item.title} mis à jour.`);
            } else {
                console.log(`➖ ${item.title_fr || item.title} : aucune mise à jour nécessaire.`);
            }
        } catch (e) { 
            console.error(`❌ Erreur lors du traitement de ${item.title_fr || item.title}`, e); 
        }
        
        // Délai pour ne pas saturer l'API
        await new Promise(r => setTimeout(r, 400));
    }

    // Fin du traitement
    if (!silent) {
        if (btn) btn.innerHTML = originalContent;
        document.getElementById('btn-mass-update-series').disabled = false;
        document.getElementById('btn-mass-update-movie').disabled = false;
        alert(`Mise à jour terminée : ${updatedCount} élément(s) mis à jour.`);
        location.reload();
    }
}
