'use strict';

// ============================================================
// API — requêtes TMDB, fallback OMDb et formatage des données
// ============================================================

async function getImdbRating(imdbId) {
    if (!imdbId) return null;
    try {
        const res = await fetch(`https://www.omdbapi.com/?apikey=1e01c814&i=${imdbId}`);
        const data = await res.json();
        return data.imdbRating && data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null;
    } catch (e) {
        return null;
    }
}

async function forceSync() {
    const btn = document.getElementById('cloudStatus');
    if (btn) btn.textContent = 'Sync...';
    
    try {
        console.log("--- DÉBUT DE LA SYNCHRONISATION ---");
        
        // 1. Sécurité anti-crash si la base locale a été vidée manuellement
        if (!library) {
            library = [];
        }

        if (library.length === 0) {
            console.log("Bibliothèque locale vide. Téléchargement depuis le Cloud en cours...");
        }

        // 2. Lancement de votre synchronisation normale (Supabase)
        // Vérifiez le nom exact de votre fonction de synchro habituelle
        if (typeof syncSupabase === 'function') {
            await syncSupabase();
        } else if (typeof syncData === 'function') {
            await syncData();
        } else {
            throw new Error("Fonction de synchronisation introuvable dans le code.");
        }
        
        console.log("✅ Synchronisation réussie.");
        if (btn) {
            btn.textContent = '○ Cloud OK';
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-teal-400');
        }
        
        // Rafraîchir l'interface
        if (typeof renderLibrary === 'function' && !document.getElementById('tab-library').classList.contains('hidden')) {
            renderLibrary();
        }
        
    } catch (error) {
        console.error(error); 
        
        if (btn) {
            btn.textContent = '⚠ Err Sync';
            btn.classList.remove('text-gray-400', 'text-teal-400');
            btn.classList.add('text-red-400');
        }
    }
}

async function getEnhancedRating(tmdbId, mediaType, tmdbVoteAverage, tmdbVoteCount) {
    const MIN_VOTES_REQUIRED = 50; 
    if (tmdbVoteCount >= MIN_VOTES_REQUIRED && tmdbVoteAverage > 0) {
        return Math.round(tmdbVoteAverage * 10) / 10;
    }

    try {
        const idsRes = await fetch(`${TMDB_BASE}/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const externalIds = await idsRes.json();
        
        if (externalIds.imdb_id) {
            const omdbRating = await getImdbRating(externalIds.imdb_id);
            if (omdbRating) {
                return omdbRating;
            }
        }
    } catch (error) {
        console.error("Erreur lors du fallback OMDb :", error);
    }
    return Math.round(tmdbVoteAverage * 10) / 10;
}

async function fetchAllTmdbEpisodes(tmdbId) {
    let episodes = [];
    try {
        const showRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        if (!showRes.ok) return episodes;
        const showData = await showRes.json();
        const seasons = showData.seasons.filter(s => s.season_number > 0);
        const seasonsData = await Promise.all(seasons.map(s => fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=fr-FR`).then(r => r.json()).catch(() => ({}))));
        
        seasonsData.forEach(seasonData => {
            if (seasonData.episodes) {
                seasonData.episodes.forEach(apiEp => {
                    episodes.push({ 
                        id: apiEp.id, 
                        season: apiEp.season_number, 
                        number: apiEp.episode_number, 
                        name: apiEp.name, 
                        airdate: apiEp.air_date, 
                        runtime: apiEp.runtime || 0, 
                        rating: Math.round((apiEp.vote_average || 0) * 10) / 10, 
                        summary: apiEp.overview || '', 
                        watched: false 
                    });
                });
            }
        });

        // LOGIQUE DE CORRECTION DES NOTES MANQUANTES
        const validRatings = episodes.map(e => e.rating).filter(r => r > 0);
        if (validRatings.length > 0) {
            const minRating = Math.min(...validRatings);
            episodes.forEach(ep => {
                if (!ep.rating || ep.rating === 0) {
                    ep.rating = minRating;
                }
            });
        }

    } catch (e) { console.error("Erreur:", e); }
    return episodes;
}

async function enrichTmdbList(items) {
    await Promise.all(items.map(async item => {
        try {
            // Conversion vitale de "series" vers "tv" pour l'API TMDB
            const tmdbType = item.type === 'series' ? 'tv' : 'movie';
            const res = await fetch(`${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            
            if (res.ok) {
                const m = await res.json();
                if (m.overview) item.summary = m.overview;
                // Intégration de getEnhancedRating
                if (m.vote_average !== undefined) {
                     item.rating = await getEnhancedRating(item.apiId, tmdbType, m.vote_average, m.vote_count);
                }
                if (m.networks?.length) item.network = m.networks[0].name;
                // Enregistrement de la date de sortie complète pour les films
                if (item.type === 'movie' && m.release_date) {
                    item.releaseDate = m.release_date;
                }
            }
        } catch (e) {
            console.error("Erreur lors de l'enrichissement :", e);
        }
    }));
    return items;
}

async function quickAdd(mediaId, watched) {
    let media = searchResults.find(r => r.id === mediaId) 
         || discoverResults.find(r => r.id === mediaId) 
         || (typeof modalSuggestionsPool !== 'undefined' ? modalSuggestionsPool.find(r => r.id === mediaId) : null);
    if (!media || isMediaInLibrary(media)) return;
    
    let episodes = [];
    if (media.type === 'series') {
        const apiEps = await fetchAllTmdbEpisodes(media.apiId);
        episodes = apiEps.map(ep => ({ ...ep, watched: watched && (ep.airdate && ep.airdate <= todayString) }));
    }
    
    media.rating = Math.round((media.rating || 0) * 10) / 10;

    const newItem = { 
        ...media, 
        episodes, 
        status: watched ? 'Watched' : 'In Progress', 
        addedAt: Date.now(), 
        last_modified: Date.now() 
    };
    
    library.push(newItem); 
    rebuildLibraryIndex(); 
    saveLocalDB(newItem);
}
