'use strict';
// ============================================================
// SEARCH — onglet "Chercher" (recherche 100% TMDB)
// ============================================================

function setMediaType(type) {
    currentMediaType = type;
    document.getElementById('btn-series').className = type === 'series' ? 'py-2 text-sm font-bold rounded-lg bg-teal-600 text-white shadow' : 'py-2 text-sm font-bold rounded-lg text-gray-400';
    document.getElementById('btn-movie').className = type === 'movie' ? 'py-2 text-sm font-bold rounded-lg bg-teal-600 text-white shadow' : 'py-2 text-sm font-bold rounded-lg text-gray-400';
    resetAndDisplaySearch();
}

async function triggerFuzzySearch(query) {
    try {
        const q = query.toLowerCase(); 
        let results = [];

        // On lance deux recherches TMDB en parallèle : Séries (tv) et Films (movie)
        const [tmdbTvRes, tmdbMovieRes] = await Promise.all([
            fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] })),
            fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ results: [] }))
        ]);

        // Mapping des SÉRIES TMDB
        let tmdbTvItems = tmdbTvRes.results ? tmdbTvRes.results.map(s => ({
            id: `series-${s.id}`, 
            apiId: s.id, // LE VRAI ID TMDB !
            title: s.original_name || s.name, 
            title_fr: s.name, 
            type: 'series',
            image: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : '', 
            rating: s.vote_average || 0, 
            genres: [], 
            premiered: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A', 
            runtime: 0, 
            summary: s.overview || ''
        })) : [];

        // Mapping des FILMS TMDB
        let tmdbMovieItems = tmdbMovieRes.results ? tmdbMovieRes.results.map(m => ({
            id: `movie-${m.id}`, 
            apiId: m.id, // ID TMDB
            title: m.original_title || m.title, 
            title_fr: m.title, 
            type: 'movie',
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', 
            rating: m.vote_average || 0, 
            genres: [], 
            premiered: m.release_date ? m.release_date.split('-')[0] : 'N/A', 
            runtime: 120, 
            summary: m.overview || ''
        })) : [];

        // On fusionne les deux tableaux
        results = [...tmdbTvItems, ...tmdbMovieItems];

        // Déduplication de sécurité (pour éviter d'avoir 2 fois le même film/série)
        searchResults = results.filter((v, i, a) => a.findIndex(t => (t.id === v.id) || (t.title && v.title && t.title.toLowerCase() === v.title.toLowerCase() && t.type === v.type)) === i);

        // Tri par note globale (du mieux noté au moins bien noté)
        searchResults.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        
        resetAndDisplaySearch();
    } catch (e) {
        console.error("Erreur lors de la recherche TMDB:", e);
    }
}

function resetAndDisplaySearch() { searchPage = 1; renderSearchGrid(true); }

function renderSearchGrid(clear = false) {
    const container = document.getElementById('searchResults'); 
    if (clear) container.innerHTML = '';
    
    let filtered = searchResults.filter(r => r.type === currentMediaType);
    const start = clear ? 0 : (searchPage - 1) * PAGE_SIZE; 
    const limit = clear ? searchPage * PAGE_SIZE : start + PAGE_SIZE;
    
    const slice = filtered.slice(start, limit); 
    const frag = document.createDocumentFragment();
    
    slice.forEach(m => frag.appendChild(createMediaCard(m, false))); 
    container.appendChild(frag);
    
    observeLazyImages();
}

const searchObserver = new IntersectionObserver(entries => { 
    if (entries[0].isIntersecting && searchPage * PAGE_SIZE < searchResults.length) { 
        searchPage++; 
        renderSearchGrid(false); 
    } 
});
