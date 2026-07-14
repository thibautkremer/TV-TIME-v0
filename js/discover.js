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
        await ensureShowsPool();
        let pool = showsCache.filter(s => !isMediaInLibrary({ id: `series-${s.id}`, title: s.name, type: 'series' }));

        if (currentDiscoverMode === 'mix') {
            const gc = {}; const nc = {}; let sumR = 0, countR = 0;
            library.forEach(i => { (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1); if (i.network && i.network !== 'Inconnu') nc[i.network] = (nc[i.network] || 0) + 1; const r = getCalculatedRating(i); if (r > 0) { sumR += r; countR++; } });
            const topGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
            const topNetworks = Object.entries(nc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
            const userAvg = countR > 0 ? sumR / countR : 7;

            let scoredPool = pool.map(s => {
                let score = 0; let sharedG = 0;
                s.genres?.forEach(g => { if (topGenres.includes(g)) sharedG++; }); score += sharedG * 15;
                if (topNetworks.includes(s.network?.name) || preferredPlatforms.includes(s.network?.name)) score += 20;
                if (s.rating?.average >= userAvg) score += 10;
                let matchPercent = Math.min(99, Math.max(40, Math.round(40 + score)));
                let norm = normalizeShow(s); norm.matchPercent = matchPercent; return norm;
            });
            discoverResults = scoredPool.filter(s => s.matchPercent >= 75).sort((a, b) => b.matchPercent - a.matchPercent);
            if (discoverResults.length === 0) { document.getElementById('discoverGrid').innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Ajoutez plus de médias pour calculer des recommandations précises (>= 75%).</p>'; return; }
        }
        else if (currentDiscoverMode === 'top') discoverResults = pool.filter(s => s.rating?.average > 0).sort((a, b) => b.rating.average - a.rating.average).map(normalizeShow);
        else if (currentDiscoverMode === 'trending') discoverResults = pool.filter(s => s.status === 'Running').sort((a, b) => b.updated - a.updated).map(normalizeShow);
    } else {
        const res = await fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&page=1`);
        const data = await res.json();
        let uniqueMovies = data.results ? data.results.map(m => ({
            id: `movie-${m.id}`, apiId: m.id, title: m.original_title || m.title, title_fr: m.title, type: 'movie',
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '', rating: m.vote_average || 0, premiered: m.release_date ? m.release_date.split('-')[0] : 'N/A'
        })).filter(v => !isMediaInLibrary(v)) : [];

        await enrichTmdbList(uniqueMovies);

        if (currentDiscoverMode === 'mix') {
            const gc = {}; library.forEach(i => (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1));
            const topGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
            let scoredPool = uniqueMovies.map(m => {
                let score = 0; m.genres?.forEach(g => { if (topGenres.includes(g)) score += 20; });
                if (preferredPlatforms.includes(m.network)) score += 20; if (m.rating >= 7) score += 10;
                m.matchPercent = Math.min(99, Math.max(40, Math.round(40 + score))); return m;
            });
            discoverResults = scoredPool.filter(s => s.matchPercent >= 75).sort((a, b) => b.matchPercent - a.matchPercent);
            if (discoverResults.length === 0) { document.getElementById('discoverGrid').innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">Ajoutez plus de médias pour calculer des recommandations précises (>= 75%).</p>'; return; }
        } else { discoverResults = uniqueMovies.sort(() => 0.5 - Math.random()); }
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
