'use strict';
// ============================================================
// SEARCH — onglet "Chercher" (recherche floue TVMaze/TMDB)
// ============================================================

function setMediaType(type) {
    currentMediaType = type;
    document.getElementById('btn-series').className = type === 'series' ? 'py-2 text-sm font-bold rounded-lg bg-teal-600 text-white shadow' : 'py-2 text-sm font-bold rounded-lg text-gray-400';
    document.getElementById('btn-movie').className = type === 'movie' ? 'py-2 text-sm font-bold rounded-lg bg-teal-600 text-white shadow' : 'py-2 text-sm font-bold rounded-lg text-gray-400';
    resetAndDisplaySearch();
}

async function triggerFuzzySearch(query) {
    try {
        const q = query.toLowerCase(); let results = [];
        if (showsCache.length === 0) await ensureShowsPool();
        const localMatches = showsCache.filter(s => s.name.toLowerCase().includes(q));
        results = results.concat(localMatches.map(normalizeShow));

        const [tvmazeRes, tmdbMovieRes] = await Promise.all([
            fetch(`${TVMAZE_API}/search/shows?q=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
            fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] }))
        ]);

        if (Array.isArray(tvmazeRes)) results = results.concat(tvmazeRes.map(i => normalizeShow(i.show)));

        let tmdbMovieItems = tmdbMovieRes.results ? tmdbMovieRes.results.map(m => ({
            id: `movie-${m.id}`, apiId: m.id, title: m.original_title || m.title, title_fr: m.title, type: 'movie',
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', rating: m.vote_average || 0, genres: [], premiered: m.release_date ? m.release_date.split('-')[0] : 'N/A', runtime: 120, summary: m.overview || ''
        })) : [];

        results = results.concat(tmdbMovieItems);
        searchResults = results.filter((v, i, a) => a.findIndex(t => (t.id === v.id) || (t.title && v.title && t.title.toLowerCase() === v.title.toLowerCase() && t.type === v.type)) === i);

        searchResults.sort((a, b) => {
            const aPref = preferredPlatforms.includes(a.network) ? 1 : 0; const bPref = preferredPlatforms.includes(b.network) ? 1 : 0;
            if (bPref !== aPref) return bPref - aPref; return (b.rating || 0) - (a.rating || 0);
        });
        resetAndDisplaySearch();
    } catch (e) {}
}

function resetAndDisplaySearch() { searchPage = 1; renderSearchGrid(true); }

function renderSearchGrid(clear = false) {
    const container = document.getElementById('searchResults'); if (clear) container.innerHTML = '';
    let filtered = searchResults.filter(r => r.type === currentMediaType);
    const start = clear ? 0 : (searchPage - 1) * PAGE_SIZE; const limit = clear ? searchPage * PAGE_SIZE : start + PAGE_SIZE;
    const slice = filtered.slice(start, limit); const frag = document.createDocumentFragment();
    slice.forEach(m => frag.appendChild(createMediaCard(m, false))); container.appendChild(frag);
    observeLazyImages();
}

const searchObserver = new IntersectionObserver(entries => { if (entries[0].isIntersecting && searchPage * PAGE_SIZE < searchResults.length) { searchPage++; renderSearchGrid(false); } });
