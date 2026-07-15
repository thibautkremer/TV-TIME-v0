'use strict';

// Remplace OMDB_API_KEY par ta clé OMDB si tu en as une (ou utilise une clé gratuite limitée)
async function getImdbRating(imdbId) {
    if (!imdbId) return null;
    try {
        const res = await fetch(`https://www.omdbapi.com/?apikey=TA_CLE_OMDB&i=${1e01c814}`);
        const data = await res.json();
        return data.imdbRating ? parseFloat(data.imdbRating) : null;
    } catch (e) {
        return null;
    }
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
                        // Arrondi strict à 1 décimale (ex: 7.5)
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
            const res = await fetch(`${TMDB_BASE}/${item.type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            if (res.ok) {
                const m = await res.json();
                if (m.overview) item.summary = m.overview;
                // Arrondi strict à 1 décimale
                if (m.vote_average) item.rating = Math.round((m.vote_average || 0) * 10) / 10;
                if (m.networks?.length) item.network = m.networks[0].name;
            }
        } catch (e) {}
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
    
    // Arrondi de la note globale lors de l'ajout
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
