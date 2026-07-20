'use strict';
// ============================================================
// DISCOVER — Suggestions intelligentes et Tops
// ============================================================

window.setDiscoverType = function(type) {
    discoverMediaType = type;
    ['series', 'movie', 'anime'].forEach(t => {
        const btn = document.getElementById(`btn-disc-type-${t}`);
        if (btn) btn.className = type === t ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    });
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(false);
};

window.setDiscoverMode = function(mode) {
    currentDiscoverMode = mode;
    ['mix', 'top', 'trending'].forEach(m => { 
        const btn = document.getElementById(`btn-disc-${m}`);
        if (btn) btn.className = m === mode ? "py-1.5 text-xs font-bold rounded bg-teal-600 text-white shadow" : "py-1.5 text-xs font-bold rounded bg-gray-700 text-gray-300"; 
    });
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(false);
};

function displayLoadingSkeletons(containerId, count = 15) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        if (typeof createSkeletonCard === 'function') frag.appendChild(createSkeletonCard());
    }
    container.appendChild(frag);
}

async function renderDiscoverTab(isAppend = false) {
    if (!isAppend && discoverResults.length > 0) return;
    if (!isAppend) {
        displayLoadingSkeletons('discoverGrid', 20);
        discoverPage = 1;
    }

    let endpoint = discoverMediaType === 'movie' ? 'movie' : 'tv';
    let extraParams = '';
    
    if (discoverMediaType === 'anime') {
        extraParams = '&with_genres=16&with_original_language=ja';
    } else if (discoverMediaType === 'series') {
        extraParams = '&without_genres=16';
    }

    let baseApiUrl = '';
    if (currentDiscoverMode === 'top') {
        // EXIGENCE : Ne prend en compte que les médias avec beaucoup de notes (>= 1000 pour plus de pertinence)
        baseApiUrl = `${TMDB_BASE}/discover/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=1000${extraParams}`;
    } else if (currentDiscoverMode === 'trending') {
        baseApiUrl = `${TMDB_BASE}/trending/${endpoint}/week?api_key=${TMDB_API_KEY}&language=fr-FR`;
    } else {
        baseApiUrl = `${TMDB_BASE}/discover/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=100${extraParams}`;
    }

    try {
        // Pour avoir ~50 résultats, on récupère 3 à 4 pages (TMDB = 20/page)
        const pagesToFetch = isAppend ? [discoverPage, discoverPage + 1] : [1, 2, 3];
        const fetchPromises = pagesToFetch.map(p => fetch(`${baseApiUrl}&page=${p}`).then(r => r.json()).catch(() => ({ results: [] })));
        const resultsArray = await Promise.all(fetchPromises);
        
        let rawResults = [];
        resultsArray.forEach(data => { if (data.results) rawResults.push(...data.results); });
        
        // Filtrage manuel pour les tendances car TMDB ne permet pas de filtrer les genres sur l'endpoint trending
        if (currentDiscoverMode === 'trending') {
            rawResults = rawResults.filter(m => {
                const isAnime = (m.genre_ids || []).includes(16) || m.original_language === 'ja';
                if (discoverMediaType === 'anime') return isAnime;
                if (discoverMediaType === 'series') return !isAnime;
                return true; 
            });
        }

        let pool = rawResults.map(m => ({
            id: `${discoverMediaType === 'movie' ? 'movie' : 'series'}-${m.id}`, 
            apiId: m.id, 
            title: m.title || m.name, 
            title_fr: m.title || m.name, 
            type: discoverMediaType === 'movie' ? 'movie' : 'series', 
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', 
            rating: m.vote_average || 0, 
            premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
            network: m.networks?.[0]?.name || 'TMDB',
            original_language: m.original_language,
            genres: m.genre_ids || []
        })).filter(v => typeof isMediaInLibrary === 'function' && !isMediaInLibrary(v));

        // Déduplication
        pool = pool.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        let scoredPool = pool;
        
        if (currentDiscoverMode === 'mix') {
            const userGenreScore = {};
            if (typeof library !== 'undefined') {
                library.forEach(item => {
                    (item.genres || []).forEach(g => {
                        let id = parseInt(g);
                        if (!isNaN(id)) {
                            userGenreScore[id] = (userGenreScore[id] || 0) + 1;
                        }
                    });
                });
            }

            const maxGScore = Math.max(...Object.values(userGenreScore), 1);

            scoredPool = pool.map(m => {
                let gScore = 0;
                (m.genres || []).forEach(gId => {
                    if (userGenreScore[gId]) gScore += (userGenreScore[gId] / maxGScore) * 10;
                });

                // Algo de match intelligent : vote_average (0-10) + score_genre (0-10)
                let rawScore = (m.rating || 5) + Math.min(gScore, 10);
                let match = Math.round((rawScore / 20) * 100);

                // Petite part d'aléatoire pour la découverte
                match += Math.floor(Math.random() * 6) - 3;

                return { ...m, matchPercent: Math.min(99, Math.max(10, match)) }; 
            });
            scoredPool.sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0));
            
        } else if (currentDiscoverMode === 'top') {
            scoredPool.sort((a, b) => b.rating - a.rating);
        }

        if (isAppend) {
            discoverResults = [...discoverResults, ...scoredPool];
            renderDiscoverGrid(false, scoredPool); 
            discoverPage += pagesToFetch.length;
        } else {
            discoverResults = scoredPool;
            renderDiscoverGrid(true, discoverResults); 
            discoverPage = pagesToFetch.length + 1;
        }

    } catch (e) {
        console.error("Erreur discover:", e);
        if (!isAppend) {
            const grid = document.getElementById('discoverGrid');
            if (grid) grid.innerHTML = '<p class="text-center text-gray-500 col-span-full">Erreur de chargement des suggestions.</p>';
        }
    }
}

function renderDiscoverGrid(clear = false, itemsToRender = []) {
    const container = document.getElementById('discoverGrid'); 
    if (!container) return;
    if (clear) container.innerHTML = '';
    
    const frag = document.createDocumentFragment(); 
    itemsToRender.forEach(m => {
        if (typeof createMediaCard === 'function') frag.appendChild(createMediaCard(m, 'discover'));
    });
    container.appendChild(frag); 
    
    if (typeof observeLazyImages === 'function') observeLazyImages();
}

window.discoverObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && typeof discoverResults !== 'undefined' && discoverResults.length > 0) { 
        renderDiscoverTab(true); 
    } 
}, { rootMargin: '400px' });
