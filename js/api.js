'use strict';
// ============================================================
// API — appels TMDB exclusifs, résolution et enrichissement
// ============================================================

// NOUVEAU : Helper pour récupérer tous les épisodes d'une série via TMDB
async function fetchAllTmdbEpisodes(tmdbId) {
    let episodes = [];
    try {
        const showRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        if (!showRes.ok) return episodes;
        const showData = await showRes.json();
        
        // On ignore la saison 0 (les bonus/specials)
        const seasons = showData.seasons.filter(s => s.season_number > 0);
        
        // Requêtes en parallèle pour toutes les saisons (beaucoup plus rapide)
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

async function ensureShowsPool() { return Promise.resolve(); }
async function preloadShowsCache() { return Promise.resolve(); }

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

async function resolveSeriesFromImdb(media) { return media; } 

async function resolveMovieFromTmdb(media) {
    if (media.type !== 'movie' || !media.apiId) return media;
    try {
        let apiIdToUse = media.apiId;
        if (String(apiIdToUse).startsWith('tt')) {
            const search = await fetch(`${TMDB_BASE}/find/${apiIdToUse}?api_key=${TMDB_API_KEY}&language=fr-FR&external_source=imdb_id`);
            if (search.ok) { const s = await search.json(); if (s.movie_results?.length > 0) apiIdToUse = s.movie_results[0].id; media.apiId = apiIdToUse; }
        }
        const res = await fetch(`${TMDB_BASE}/movie/${apiIdToUse}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        if (res.ok) {
            const m = await res.json();
            media.summary = m.overview || media.summary; media.rating = m.vote_average || media.rating;
            media.runtime = m.runtime || media.runtime; media.network = m.production_companies?.length > 0 ? m.production_companies[0].name : 'Inconnu';
            media.genres = m.genres ? m.genres.map(g => g.name) : media.genres;
            if (m.poster_path) media.image = `https://image.tmdb.org/t/p/w500${m.poster_path}`;
            media.title_fr = m.title || media.title_fr;
            if (m.release_date) media.releaseDate = m.release_date;
        }
    } catch (e) {} return media;
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
