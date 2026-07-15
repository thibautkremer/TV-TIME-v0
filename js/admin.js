'use strict';
// ============================================================
// ADMIN — MAJ de masse API (Metadata + Épisodes + Notes)
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

    console.log(`--- DÉBUT DE LA MISE À JOUR COMPLETE (${type}) : ${total} médias ---`);

    for (let i = 0; i < total; i++) {
        let item = itemsToProcess[i];
        
        if (!silent && btn) {
            btn.innerHTML = `⏳ [${i + 1}/${total}] ${item.title_fr || item.title}`;
        }
        
        console.log(`[${i + 1}/${total}] Traitement : ${item.title_fr || item.title} (ID: ${item.apiId})`);

        try {
            // 1. Récupération des infos de base
            const url = `${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`;
            const res = await fetch(url);
            
            if (res.status === 404) {
                console.warn(`⚠️ Introuvable sur TMDB : ${item.title_fr || item.title}.`);
                errorCount++;
                continue; 
            }
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            const data = await res.json();
            
            let changes = [];

            // 2. Mise à jour Métadonnées (Résumé, Image, Plateforme)
            if (data.overview && item.summary !== data.overview) { 
                changes.push("Résumé mis à jour"); 
                item.summary = data.overview; 
            }
            
            const newImage = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
            if (data.poster_path && item.image !== newImage) { 
                changes.push("Image mise à jour"); 
                item.image = newImage; 
            }

            if (type === 'movie' && data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) {
                const prov = data['watch/providers'].results.FR.flatrate[0].provider_name;
                if (item.network !== prov) { 
                    changes.push(`Plateforme (${item.network} -> ${prov})`);
                    item.network = prov; 
                }
            }

            // 3. Mise à jour Profonde (Séries uniquement : Épisodes, Structure, Notes)
            if (type === 'series') {
                const freshEpisodes = await fetchAllTmdbEpisodes(item.apiId);
                
                if (freshEpisodes.length > 0) {
                    // Sauvegarde du statut "Vu" actuel avant structure écrasée
                    const oldWatchedIds = new Set((item.episodes || []).filter(e => e.watched).map(e => String(e.id)));
                    const oldWatchedCount = (item.episodes || []).filter(e => e.watched).length;

                    // Matching : Si structure différente, on applique le matching séquentiel
                    const strictMatchPossible = freshEpisodes.some(e => oldWatchedIds.has(String(e.id)));
                    
                    freshEpisodes.forEach((ep, idx) => {
                        // Ré-application du statut Vu
                        if (strictMatchPossible) ep.watched = oldWatchedIds.has(String(ep.id));
                        else ep.watched = idx < oldWatchedCount; // Séquentiel (pour les animes fusionnés)
                        
                        // Journalisation des changements de notes individuelles
                        const oldEp = (item.episodes || []).find(e => e.season === ep.season && e.number === ep.number);
                        if (oldEp && oldEp.rating !== ep.rating) {
                            changes.push(`Note Ep S${ep.season}E${ep.number} (${oldEp.rating} -> ${ep.rating})`);
                        }
                    });

                    // Recalcul note globale
                    const newAvg = computeAvgEpisodeRating(freshEpisodes);
                    if (item.rating !== newAvg) { 
                        changes.push(`Note Globale (${item.rating} -> ${newAvg})`);
                        item.rating = newAvg; 
                    }
                    item.episodes = freshEpisodes;
                }
            } else if (type === 'movie' && data.vote_average) {
                // Arrondi pour les films
                const roundedNew = Math.round(data.vote_average * 10) / 10;
                if (item.rating !== roundedNew) { 
                    changes.push(`Note (${item.rating} -> ${roundedNew})`);
                    item.rating = roundedNew; 
                }
            }

            // 4. Sauvegarde
            if (changes.length > 0) {
                item.last_modified = Date.now();
                await saveLocalDB(item);
                updatedCount++;
                console.log(`✅ ${item.title_fr || item.title} :`, changes);
            } else {
                noChangeCount++;
                console.log(`➖ Inchangé : ${item.title_fr || item.title}`);
            }
        } catch (e) { 
            errorCount++;
            console.error(`❌ Erreur sur ${item.title_fr || item.title}:`, e); 
        }
        
        await new Promise(r => setTimeout(r, 400));
    }

    console.log(`--- FIN : ${updatedCount} mis à jour, ${noChangeCount} inchangés, ${errorCount} erreurs ---`);
    if (!silent) {
        if (btn) btn.innerHTML = originalContent;
        document.getElementById('btn-mass-update-series').disabled = false;
        document.getElementById('btn-mass-update-movie').disabled = false;
        alert(`Mise à jour terminée.\nMis à jour : ${updatedCount}\nInchangés : ${noChangeCount}\nErreurs : ${errorCount}`);
        location.reload();
    }
}
