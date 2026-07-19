'use strict';
// ============================================================
// SEARCH — Moteur de recherche (Séries, Films, Animes)
// ============================================================

window.currentSearchType = 'series';

function ensureSearchAnimeButton() {
    const btnSeries = document.getElementById('btn-search-type-series');
    const container = btnSeries?.parentElement;
    if (container && !document.getElementById('btn-search-type-anime')) {
        const btnAnime = document.createElement('button');
        btnAnime.id = 'btn-search-type-anime';
        btnAnime.onclick = () => setSearchType('anime');
        btnAnime.textContent = 'Animes';
        btnAnime.className = 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
        container.appendChild(btnAnime);
    }
}

function setSearchType(type) {
    ensureSearchAnimeButton();
    window.currentSearchType = type;
    ['series', 'movie', 'anime'].forEach(t => {
        const btn = document.getElementById(`btn-search-type-${t}`);
        if (btn) btn.className = type === t ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    });
    
    const input = document.getElementById('searchInput');
    if (input && input.value.trim() !== '') {
        performSearch(input.value.trim());
    }
}

async function performSearch(query) {
    const grid = document.getElementById('searchResults');
    if (!grid) return;
    
    if (!query) {
        grid.innerHTML = '';
        if (typeof searchResults !== 'undefined') searchResults = [];
        return;
    }

    if (typeof displayLoadingSkeletons === 'function') displayLoadingSkeletons('searchResults', 6);

    // TMDB ne permet pas de filtrer /search/multi par genre facilement. 
    // On utilise les points d'entrée spécifiques et on filtre localement pour les animes.
    let endpoint = window.currentSearchType === 'movie' ? 'movie' : 'tv';
    let url = `${TMDB_BASE}/search/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        
        let results = data.results || [];

        // Filtre strict pour l'onglet actif
        results = results.filter(m => {
            if (window.currentSearchType === 'movie') return true; // C'est déjà filtré par l'endpoint
            
            const isAnime = (m.genre_ids || []).includes(16) || m.original_language === 'ja';
            if (window.currentSearchType === 'anime') return isAnime;
            if (window.currentSearchType === 'series') return !isAnime;
            
            return true;
        });

        if (typeof searchResults !== 'undefined') {
            searchResults = results.map(m => ({
                id: `${window.currentSearchType === 'movie' ? 'movie' : 'series'}-${m.id}`,
                apiId: m.id,
                title: m.title || m.name,
                title_fr: m.title || m.name,
                type: window.currentSearchType === 'movie' ? 'movie' : 'series',
                image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                rating: m.vote_average || 0,
                premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
                original_language: m.original_language,
                genres: m.genre_ids
            }));
        }

        renderSearchGrid();

    } catch (error) {
        console.error("Erreur de recherche:", error);
        grid.innerHTML = '<p class="text-center text-red-500 text-xs w-full py-4">Erreur de connexion.</p>';
    }
}

function renderSearchGrid() {
    const grid = document.getElementById('searchResults');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (!searchResults || searchResults.length === 0) {
        grid.innerHTML = '<p class="text-center text-gray-500 text-xs w-full py-4">Aucun résultat trouvé.</p>';
        return;
    }

    const frag = document.createDocumentFragment();
    searchResults.forEach(m => {
        if (typeof createMediaCard === 'function') frag.appendChild(createMediaCard(m, 'search'));
    });
    grid.appendChild(frag);
    
    if (typeof observeLazyImages === 'function') observeLazyImages();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    ensureSearchAnimeButton();
    const searchInput = document.getElementById('searchInput');
    let timeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => performSearch(e.target.value.trim()), 500);
        });
    }
});
