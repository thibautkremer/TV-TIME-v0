'use strict';
// ============================================================
// API — appels TVMaze / TMDB, résolution et enrichissement
// ============================================================

async function ensureShowsPool() { if (showsCache.length > 0) return; const res = await fetch(`${TVMAZE_API}/shows?page=0`); showsCache = await res.json(); }
async function preloadShowsCache() { await ensureShowsPool(); }

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
                if (m.production_companies?.length) item.network = m.production_companies[0].name;
            }
        } catch (e) {}
    }));
    return items;
}

async function resolveSeriesFromImdb(media) {
    if (!(media.type === 'series' && String(media.apiId).startsWith('tt'))) return media;
    try {
        const lookup = await fetch(`${TVMAZE_API}/lookup/shows?imdb=${media.apiId}`);
        if (lookup.ok) {
            const show = await lookup.json();
            media.apiId = show.id; media.id = `series-${show.id}`; media.summary = show.summary?.replace(/<[^>]*>/g, '') || media.summary;
            media.image = show.image?.medium || media.image; media.rating = show.rating?.average || media.rating;
            media.status_production = show.status || media.status_production; media.network = show.network?.name || show.webChannel?.name || media.network;
            media.premiered = show.premiered ? String(show.premiered).split('-')[0] : media.premiered; media.runtime = show.runtime || show.averageRuntime || media.runtime;
        }
    } catch (e) {} return media;
}

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
            if (m.release_date) media.releaseDate = m.release_date; // date complète (YYYY-MM-DD), utilisée par le calendrier
        }
    } catch (e) {} return media;
}

async function quickAdd(mediaId, watched) {
    let media = searchResults.find(r => r.id === mediaId) || discoverResults.find(r => r.id === mediaId); if (!media) return;
    await resolveSeriesFromImdb(media); await resolveMovieFromTmdb(media);
    if (isMediaInLibrary(media)) return;

    let episodes = []; let avgRating = 0;
    if (media.type === 'series') {
        try {
            const res = await fetch(`${TVMAZE_API}/shows/${media.apiId}/episodes`); const apiEps = await res.json();
            let sumR = 0, countR = 0;
            episodes = apiEps.map(apiEp => {
                const isReleased = apiEp.airdate && apiEp.airdate <= todayString; const r = apiEp.rating?.average || 0; if (r > 0) { sumR += r; countR++; }
                return { id: apiEp.id, season: apiEp.season, number: apiEp.number, name: apiEp.name, airdate: apiEp.airdate, runtime: apiEp.runtime, rating: r, watched: watched && isReleased };
            });
            avgRating = countR > 0 ? sumR / countR : 0;
        } catch (e) {}
    }

    const finalRating = (media.rating && media.rating > 0) ? media.rating : avgRating;
    const newItem = { ...media, episodes, rating: finalRating, status: watched ? 'Watched' : 'In Progress', addedAt: Date.now(), last_modified: Date.now() };
    library.push(newItem); libraryIndex.set(newItem.id, newItem);
    if (newItem.title) libraryTitleIndex.set(`${newItem.type}|${newItem.title.toLowerCase()}`, newItem);
    if (newItem.title_fr) libraryTitleIndex.set(`${newItem.type}|${newItem.title_fr.toLowerCase()}`, newItem);
    saveLocalDB(newItem);
}
