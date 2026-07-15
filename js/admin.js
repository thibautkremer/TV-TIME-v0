'use strict';

async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const tmdbType = (type === 'series') ? 'tv' : 'movie';
    const itemsToProcess = library.filter(i => i.type === type);
    
    for (let i = 0; i < itemsToProcess.length; i++) {
        let item = itemsToProcess[i];
        try {
            const res = await fetch(`${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`);
            if (res.status === 404) { console.warn(`⚠️ Introuvable : ${item.title} (ID: ${item.apiId})`); continue; }
            if (!res.ok) throw new Error(`Erreur ${res.status}`);
            
            const data = await res.json();
            let changes = []; // Liste des changements détectés

            // Comparaison détaillée et journalisation
            if (data.overview && item.summary !== data.overview) { 
                changes.push(`Résumé (Ancien: ${item.summary?.substring(0, 20)}... -> Nouveau: ${data.overview.substring(0, 20)}...)`); 
                item.summary = data.overview; 
            }
            
            const newImage = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
            if (data.poster_path && item.image !== newImage) { 
                changes.push("Image mise à jour"); 
                item.image = newImage; 
            }

            if (type === 'series' && item.episodes) {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                item.episodes.forEach(ep => {
                    const fresh = allEps.find(e => e.season === ep.season && e.number === ep.number);
                    if (fresh && fresh.rating !== ep.rating) {
                        changes.push(`Note Ep S${ep.season}E${ep.number} (${ep.rating} -> ${fresh.rating})`);
                        ep.rating = fresh.rating;
                    }
                });
            } else if (item.rating !== data.vote_average) {
                changes.push(`Note globale (${item.rating} -> ${data.vote_average})`);
                item.rating = data.vote_average;
            }

            if (changes.length > 0) {
                item.last_modified = Date.now();
                await saveLocalDB(item);
                console.log(`✅ ${item.title} : Modifications effectuées :`, changes);
            } else {
                console.log(`➖ ${item.title} : Aucune modification nécessaire.`);
            }
        } catch (e) {
            console.error(`❌ Erreur sur ${item.title}:`, e);
        }
        await new Promise(r => setTimeout(r, 400));
    }
    alert("Mise à jour terminée. Vérifie la console pour le détail.");
}
