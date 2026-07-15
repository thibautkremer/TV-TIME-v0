'use strict';
// ============================================================
// DISCOVER — onglet "Découvrir" avec Skeletons UI et Pagination
// ============================================================

function ensureDiscoverAnimeButton() {
    const btnSeries = document.getElementById('btn-disc-type-series');
    const container = btnSeries?.parentElement;
    if (container && !document.getElementById('btn-disc-type-anime')) {
        const btnAnime = document.createElement('button');
        btnAnime.id = 'btn-disc-type-anime';
        btnAnime.onclick = () => setDiscoverType('anime');
        btnAnime.textContent = 'Animes';
        btnAnime.className = 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
        container.appendChild(btnAnime);
    }
}

function setDiscoverType(type) {
    ensureDiscoverAnimeButton();
    discoverMediaType = type;
    ['series', 'movie', 'anime'].forEach(t => {
        const btn = document.getElementById(`btn-disc-type-${t}`);
        if (btn) btn.className = type === t ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    });
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(false);
}

function setDiscoverMode(mode) {
    currentDiscoverMode = mode;
    ['mix', 'top', 'trending'].forEach(m => { 
        const btn = document.getElementById(`btn-disc-${m}`);
        if (btn) btn.className = m === mode ? "py-1.5 text-xs font-bold rounded bg-teal-600 text-white shadow" : "py-1.5 text-xs font-bold rounded bg-gray-700 text-gray-300"; 
    });
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(false);
}

function displayLoadingSkeletons(containerId, count = 15) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(createSkeletonCard());
    container.appendChild(frag);
}

async function renderDiscoverTab(isAppend = false) {
    ensureDiscoverAnimeButton();
    if (!isAppend && discoverResults.length > 0) return;
    if (!isAppend) displayLoadingSkeletons('discoverGrid', 15);

    let endpoint = discoverMediaType === 'movie' ? 'movie' : 'tv';
    let extraParams = '';
    
    if (discoverMediaType === 'anime') {
        extraParams = '&with_genres=16&with_original_language=ja';
    } else if (discoverMediaType === 'series') {
        extraParams = '&without_genres=16'; // Exclure les animes pour les séries classiques
    }

    let baseApiUrl = '';
    if (currentDiscoverMode === 'top') {
        baseApiUrl = `${TMDB_BASE}/discover/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=vote_average.desc&vote_count.gte=300${extraParams}`;
    } else if (currentDiscoverMode === 'trending') {
        baseApiUrl = `${TMDB_BASE}/trending/${endpoint}/week?api_key=${TMDB_API_KEY}&language=fr-FR`;
    } else {
        baseApiUrl = `${TMDB_BASE}/discover/${endpoint}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&vote_count.gte=100${extraParams}`;
    }

    try {
        // Appeler 3 pages d'un coup pour garantir un volume de ~60 résultats
        const pages = [discoverPage, discoverPage + 1, discoverPage + 2];
        const fetchPromises = pages.map(p => fetch(`${baseApiUrl}&page=${p}`).then(r => r.json()).catch(() => ({})));
        const resultsArray = await Promise.all(fetchPromises);
        
        let rawResults = [];
        resultsArray.forEach(data => { if (data.results) rawResults.push(...data.results); });
        
        // Filtre manuel pour les tendances qui n'acceptent pas de paramètres
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
            type: discoverMediaType === 'movie' ? 'movie' : 'series', // Stocké en series en base
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', 
            rating: m.vote_average || 0, 
            premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
            network: m.networks?.[0]?.name || 'TMDB',
            original_language: m.original_language,
            genres: m.genre_ids 
        })).filter(v => !isMediaInLibrary(v));

        pool = pool.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        let scoredPool = pool;
        if (currentDiscoverMode === 'mix') {
            const gc = {}; 
            library.forEach(i => (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1));
            
            scoredPool = pool.map(m => {
                let score = m.rating * 3;
                return { ...m, matchPercent: Math.min(99, Math.max(10, Math.round(score * 3.3))) }; 
            });
            scoredPool.sort((a, b) => b.matchPercent - a.matchPercent);
        } else if (currentDiscoverMode === 'top') {
            scoredPool.sort((a, b) => b.rating - a.rating);
        } else {
            scoredPool.sort(() => 0.5 - Math.random());
        }

        if (isAppend) {
            discoverResults = [...discoverResults, ...scoredPool];
            renderDiscoverGrid(false, scoredPool); 
        } else {
            discoverResults = scoredPool;
            renderDiscoverGrid(true, discoverResults); 
        }
        
        discoverPage += 3;
        
    } catch (e) {
        if (!isAppend) document.getElementById('discoverGrid').innerHTML = '<p class="text-center text-gray-500">Erreur de chargement.</p>';
    }
}

function renderDiscoverGrid(clear = false, itemsToRender = []) {
    const container = document.getElementById('discoverGrid'); 
    if (clear) container.innerHTML = '';
    
    const frag = document.createDocumentFragment(); 
    itemsToRender.forEach(m => frag.appendChild(createMediaCard(m, 'discover')));
    container.appendChild(frag); 
    
    observeLazyImages();
}

const discoverObserver = new IntersectionObserver(entries => { 
    if (entries[0].isIntersecting && discoverResults.length > 0) { 
        renderDiscoverTab(true); 
    } 
});
