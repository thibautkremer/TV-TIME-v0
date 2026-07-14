'use strict';
// ============================================================
// DISCOVER — onglet "Découvrir" avec Skeletons UI et Pagination
// ============================================================

function setDiscoverType(type) {
    discoverMediaType = type;
    document.getElementById('btn-disc-type-series').className = type === 'series' ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    document.getElementById('btn-disc-type-movie').className = type === 'movie' ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(true);
}

function setDiscoverMode(mode) {
    currentDiscoverMode = mode;
    ['mix', 'top', 'trending'].forEach(m => { 
        document.getElementById(`btn-disc-${m}`).className = m === mode ? "py-1.5 text-xs font-bold rounded bg-teal-600 text-white shadow" : "py-1.5 text-xs font-bold rounded bg-gray-700 text-gray-300"; 
    });
    discoverResults = [];
    discoverPage = 1; 
    renderDiscoverTab(true);
}

function displayLoadingSkeletons(containerId, count = 12) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(createSkeletonCard());
    container.appendChild(frag);
}

async function renderDiscoverTab(force = false) {
    if (!force && discoverResults.length > 0) return;

    displayLoadingSkeletons('discoverGrid', 12);

    let apiUrl = '';
    if (discoverMediaType === 'series') {
        apiUrl = `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${discoverPage}`;
    } else {
        apiUrl = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${discoverPage}`;
    }

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        let pool = (data.results || []).map(m => ({
            id: `${discoverMediaType}-${m.id}`, 
            apiId: m.id, 
            title: m.title || m.name, 
            title_fr: m.title || m.name, 
            type: discoverMediaType,
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', 
            rating: m.vote_average || 0, 
            premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
            network: m.networks?.[0]?.name || 'TMDB'
        })).filter(v => !isMediaInLibrary(v));

        if (currentDiscoverMode === 'mix') {
            const gc = {}; 
            library.forEach(i => (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1));

            if (Object.keys(gc).length === 0) {
                discoverResults = pool.sort((a, b) => b.rating - a.rating);
            } else {
                const topGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
                let scoredPool = pool.map(m => {
                    let score = 0; 
                    if (m.genres) m.genres.forEach(g => { if (topGenres.includes(g)) score += 20; });
                    if (preferredPlatforms.includes(m.network)) score += 20; 
                    score += (m.rating * 2.5); // Poids plus élevé pour la note
                    return { ...m, matchPercent: Math.min(99, Math.max(10, Math.round(score))) };
                });
                discoverResults = scoredPool.sort((a, b) => b.matchPercent - a.matchPercent);
            }
        } else if (currentDiscoverMode === 'top') {
            discoverResults = pool.sort((a, b) => b.rating - a.rating);
        } else {
            discoverResults = pool.sort(() => 0.5 - Math.random());
        }

        renderDiscoverGrid(true);
    } catch (e) {
        document.getElementById('discoverGrid').innerHTML = '<p class="text-center text-gray-500">Erreur de chargement.</p>';
    }
}

function renderDiscoverGrid(clear = false) {
    const container = document.getElementById('discoverGrid'); 
    if (clear) container.innerHTML = '';
    
    const frag = document.createDocumentFragment(); 
    discoverResults.forEach(m => frag.appendChild(createMediaCard(m, false)));
    container.appendChild(frag); 
    
    observeLazyImages();
}

const discoverObserver = new IntersectionObserver(entries => { 
    if (entries[0].isIntersecting) { 
        discoverPage++; 
        renderDiscoverTab(true); 
    } 
});
