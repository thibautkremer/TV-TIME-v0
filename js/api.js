'use strict';
// ============================================================
// API — appels TMDB exclusifs, résolution et enrichissement
// ============================================================

async function fetchAllTmdbEpisodes(tmdbId) {
    let episodes = [];
    try {
        const showRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        if (!showRes.ok) return episodes;
        const showData = await showRes.json();
        
        const seasons = showData.seasons.filter(s => s.season_number > 0);
        
        const seasonPromises = seasons.map(s => 
            fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${s.season_number}?api_key=${TMDB_API_KEY}&language=fr-FR`)
            .then(r => r.json()).catch(() => ({}))
        );
        
        const seasonsData = await Promise.all(seasonPromises);
        
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
                        rating: apiEp.vote_average || 0,
                        summary: apiEp.overview || '',
                        watched: false
                    });
                });
            }
        });
    } catch (e) { console.error("Erreur récupération épisodes:", e); }
    return episodes;
}

async function enrichTmdbList(items) {
    await Promise.all(items.map(async item => {
        try {
            const res = await fetch(`${TMDB_BASE}/${item.type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            if (res.ok) {
                const m = await res.json();
                if (m.overview) item.summary = m.overview;
                if (m.vote_average) item.rating = m.vote_average;
                if (m.runtime || m.episode_run_time?.length) item.runtime = m.runtime || m.episode_run_time[0];
                if (m.genres) item.genres = m.genres.map(g => g.name);
                if (m.networks?.length) item.network = m.networks[0].name; 
                else if (m.production_companies?.length) item.network = m.production_companies[0].name;
            }
        } catch (e) {}
    }));
    return items;
}

async function quickAdd(mediaId, watched) {
    let media = searchResults.find(r => r.id === mediaId) || discoverResults.find(r => r.id === mediaId); 
    if (!media) return;
    if (isMediaInLibrary(media)) return;

    let episodes = []; let avgRating = 0;
    if (media.type === 'series') {
        const apiEps = await fetchAllTmdbEpisodes(media.apiId);
        let sumR = 0, countR = 0;
        episodes = apiEps.map(ep => {
            const isReleased = ep.airdate && ep.airdate <= todayString; 
            if (ep.rating > 0) { sumR += ep.rating; countR++; }
            return { ...ep, watched: watched && isReleased };
        });
        avgRating = countR > 0 ? sumR / countR : 0;
    }

    const finalRating = (media.rating && media.rating > 0) ? media.rating : avgRating;
    const newItem = { ...media, episodes, rating: finalRating, status: watched ? 'Watched' : 'In Progress', addedAt: Date.now(), last_modified: Date.now() };
    library.push(newItem); libraryIndex.set(newItem.id, newItem);
    if (newItem.title) libraryTitleIndex.set(`${newItem.type}|${newItem.title.toLowerCase()}`, newItem);
    if (newItem.title_fr) libraryTitleIndex.set(`${newItem.type}|${newItem.title_fr.toLowerCase()}`, newItem);
    saveLocalDB(newItem);
}
