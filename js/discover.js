'use strict';
// ============================================================
// DISCOVER — onglet "Découvrir" (suggestions, mieux notés, tendances)
// ============================================================

function setDiscoverType(type) {
    discoverMediaType = type;
    document.getElementById('btn-disc-type-series').className = type === 'series' ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    document.getElementById('btn-disc-type-movie').className = type === 'movie' ? 'px-5 py-1.5 text-xs font-bold rounded shadow bg-teal-600 text-white transition' : 'px-5 py-1.5 text-xs font-bold rounded text-gray-400 hover:text-white transition';
    discoverPage = 1; renderDiscoverTab(true);
}

function setDiscoverMode(mode) {
    currentDiscoverMode = mode;
    ['mix', 'top', 'trending'].forEach(m => { document.getElementById(`btn-disc-${m}`).className = m === mode ? "py-1.5 text-xs font-bold rounded bg-teal-600 text-white shadow" : "py-1.5 text-xs font-bold rounded bg-gray-700 text-gray-300"; });
    discoverPage = 1; renderDiscoverTab(true);
}

async function renderDiscoverTab(force = false) {
    if (!force && discoverResults.length > 0) return;

    if (discoverMediaType === 'series') {
        const res = await fetch(`${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&page=1`);
        const data = await res.json();
        let pool = data.results ? data.results.map(s => ({
            id: `series-${s.id}`, apiId: s.id, title: s.original_name || s.name, title_fr: s.name, type: 'series',
            image: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : '', rating: s.vote_average || 0, premiered: s.first_air_date ? s.first_air_date.split('-')[0] : 'N/A'
        })).filter(v => !isMediaInLibrary(v)) : [];

        if (currentDiscoverMode === 'mix') {
            const gc = {}; const nc = {};
            library.forEach(i => { 
                (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1); 
                if (i.network && i.network !== 'Inconnu') nc[i.network] = (nc[i.network] || 0) + 1; 
            });

            if (Object.keys(gc).length === 0) {
                discoverResults = pool.sort((a, b) => b.rating - a.rating);
            } else {
                const topGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
                let scoredPool = pool.map(s => {
                    let score = 0;
                    s.genres?.forEach(g => { if (topGenres.includes(g)) score += 20; });
                    score += (s.rating * 2); 
                    return { ...s, matchPercent: Math.min(99, Math.max(10, Math.round(score))) };
                });
                discoverResults = scoredPool.sort((a, b) => b.matchPercent - a.matchPercent);
            }
        }
        else if (currentDiscoverMode === 'top') discoverResults = pool.filter(s => s.rating > 0).sort((a, b) => b.rating - a.rating);
        else if (currentDiscoverMode === 'trending') discoverResults = pool.sort(() => 0.5 - Math.random());
    } else {
        const res = await fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&page=1`);
        const data = await res.json();
        let pool = data.results ? data.results.map(m => ({
            id: `movie-${m.id}`, apiId: m.id, title: m.original_title || m.title, title_fr: m.title, type: 'movie',
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', rating: m.vote_average || 0, premiered: m.release_date ? m.release_date.split('-')[0] : 'N/A'
        })).filter(v => !isMediaInLibrary(v)) : [];

        await enrichTmdbList(pool);

        if (currentDiscoverMode === 'mix') {
            const gc = {}; library.forEach(i => (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1));
            
            if (Object.keys(gc).length === 0) {
                discoverResults = pool.sort((a, b) => b.rating - a.rating);
            } else {
                const topGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
                let scoredPool = pool.map(m => {
                    let score = 0; 
                    m.genres?.forEach(g => { if (topGenres.includes(g)) score += 20; });
                    if (preferredPlatforms.includes(m.network)) score += 20; 
                    score += (m.rating * 2);
                    return { ...m, matchPercent: Math.min(99, Math.max(10, Math.round(score))) };
                });
                discoverResults = scoredPool.sort((a, b) => b.matchPercent - a.matchPercent);
            }
        } else { discoverResults = pool.sort(() => 0.5 - Math.random()); }
    }

    discoverResults = discoverResults.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    discoverResults.sort((a, b) => { const aPref = preferredPlatforms.includes(a.network) ? 1 : 0; const bPref = preferredPlatforms.includes(b.network) ? 1 : 0; if (bPref !== aPref) return bPref - aPref; return 0; });
    discoverPage = 1; renderDiscoverGrid(true);
}

function renderDiscoverGrid(clear = false) {
    const container = document.getElementById('discoverGrid'); if (clear) container.innerHTML = '';
    const start = clear ? 0 : (discoverPage - 1) * PAGE_SIZE; const limit = clear ? discoverPage * PAGE_SIZE : start + PAGE_SIZE;
    const frag = document.createDocumentFragment(); discoverResults.slice(start, limit).forEach(m => frag.appendChild(createMediaCard(m, false)));
    container.appendChild(frag); observeLazyImages();
}

const discoverObserver = new IntersectionObserver(entries => { if (entries[0].isIntersecting && discoverPage * PAGE_SIZE < discoverResults.length) { discoverPage++; renderDiscoverGrid(false); } });
