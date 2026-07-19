'use strict';
// ============================================================
// SEARCH — Moteur de recherche (Séries, Films, Animes)
// ============================================================

window.currentSearchType = 'series';

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    let timeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => performSearch(e.target.value.trim()), 500);
            
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) clearBtn.classList.toggle('hidden', e.target.value.length === 0);
        });
    }
});

function setSearchType(type) {
    window.currentSearchType = type;
    
    // Mise à jour visuelle des boutons
    ['series', 'anime', 'movie'].forEach(t => {
        const btn = document.getElementById(`btn-search-type-${t}`);
        if (btn) {
            if (type === t) {
                btn.className = 'py-2 px-1 text-[10px] font-black rounded-lg bg-teal-600 text-white shadow transition flex items-center justify-center text-center';
            } else {
                btn.className = 'py-2 px-1 text-[10px] font-bold rounded-lg text-gray-400 hover:bg-gray-700 transition flex items-center justify-center text-center';
            }
        }
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

    let endpoint = window.currentSearchType === 'movie' ? 'movie' : 'tv';
    let url = `${TMDB_BASE}/search/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=1`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        let results = data.results || [];

        results = results.filter(m => {
            if (window.currentSearchType === 'movie') return true;
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
