'use strict';
// ============================================================
// ADMIN — MAJ de masse API 100% TMDB
// ============================================================

async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const originalContent = btn ? btn.innerHTML : '';
    
    // TMDB utilise "/tv/" pour les séries, pas "/series/"
    const tmdbType = (type === 'series') ? 'tv' : 'movie';
    
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
    let errorCount = 0;
    let noChangeCount = 0;

    console.log(`--- DÉBUT DE LA MISE À JOUR MASSIVE (${type}) : ${total} médias ---`);

    for (let i = 0; i < total; i++) {
        let item = itemsToProcess[i];
        
        // Réintégration du libellé dynamique avec progression
        if (!silent && btn) {
            btn.innerHTML = `⏳ [${i + 1}/${total}] ${item.title_fr || item.title}`;
        }
        
        console.log(`[${i + 1}/${total}] Traitement de : ${item.title_fr || item.title} (ID: ${item.apiId})`);

        try {
            const url = `${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`;
            const res = await fetch(url);
            
            // Gestion spécifique du 404 pour continuer la boucle
            if (res.status === 404) {
                console.warn(`⚠️ Introuvable sur TMDB (404) : ${item.title_fr || item.title} (ID: ${item.apiId}).`);
                errorCount++;
                continue; 
            }
            
            if (!res.ok) throw new Error(`Erreur API TMDB ${res.status}`);
            const data = await res.json();
            
            let changes = [];

            // 1. Mise à jour Plateforme (Film uniquement)
            if (type === 'movie' && data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) {
                const prov = data['watch/providers'].results.FR.flatrate[0].provider_name;
                if (item.network !== prov) { 
                    changes.push(`Plateforme (${item.network} -> ${prov})`);
                    item.network = prov; 
                }
            }

            // 2. Mise à jour Résumé
            if (data.overview && item.summary !== data.overview) { 
                changes.push("Résumé mis à jour"); 
                item.summary = data.overview; 
            }
            
            // 3. Mise à jour Affiche
            const newImage = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
            if (data.poster_path && item.image !== newImage) { 
                changes.push("Image mise à jour"); 
                item.image = newImage; 
            }

            // 4. Mise à jour Notes (Épisodes ou Globale)
            if (type === 'series' && item.episodes) {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                if (allEps.length > 0) {
                    item.episodes.forEach(ep => {
                        const fresh = allEps.find(e => e.season === ep.season && e.number === ep.number);
                        if (fresh && fresh.rating !== ep.rating) { 
                            changes.push(`Note Ep S${ep.season}E${ep.number} (${ep.rating} -> ${fresh.rating})`);
                            ep.rating = fresh.rating; 
                        }
                    });
                    const newAvg = computeAvgEpisodeRating(item.episodes);
                    if (item.rating !== newAvg) { 
                        changes.push(`Note Globale (${item.rating} -> ${newAvg})`);
                        item.rating = newAvg; 
                    }
                }
            } else if (type === 'movie' && data.vote_average) {
                if (item.rating !== data.vote_average) { 
                    changes.push(`Note (${item.rating} -> ${data.vote_average})`);
                    item.rating = data.vote_average; 
                }
            }

            if (changes.length > 0) {
                item.last_modified = Date.now();
                await saveLocalDB(item);
                updatedCount++;
                console.log(`✅ ${item.title_fr || item.title} : Modifications :`, changes);
            } else {
                noChangeCount++;
                console.log(`➖ Aucune modification : ${item.title_fr || item.title}`);
            }
        } catch (e) { 
            errorCount++;
            console.error(`❌ Erreur sur ${item.title_fr || item.title} (ID: ${item.apiId}):`, e); 
        }
        
        await new Promise(r => setTimeout(r, 400));
    }

    console.log(`--- FIN DE LA MISE À JOUR ---`);
    console.log(`Résultats : ${updatedCount} mis à jour, ${noChangeCount} inchangés, ${errorCount} erreurs.`);

    if (!silent) {
        if (btn) btn.innerHTML = originalContent;
        document.getElementById('btn-mass-update-series').disabled = false;
        document.getElementById('btn-mass-update-movie').disabled = false;
        alert(`Terminé.\nMis à jour : ${updatedCount}\nInchangés : ${noChangeCount}\nErreurs : ${errorCount}`);
        location.reload();
    }
}
