'use strict';
// ============================================================
// SUGGESTIONS — franchises / contenus similaires dans la fiche
// ============================================================

const suggestionsObserver = new IntersectionObserver(entries => { if (entries[0].isIntersecting && modalSuggestionsPool.length > 0) { modalSuggestionsPage++; appendSuggestions(); } });

async function renderSuggestions(currentId) {
    const block = document.getElementById('modalSuggestionsBlock');
    block.innerHTML = `<div id="modalSuggestionsList" class="space-y-2"><p class="text-xs text-teal-400 text-center py-4 animate-pulse">Recherche des franchises et contenus similaires...</p></div>`;
    try {
        await ensureShowsPool();
        const baseMedia = library.find(i => i.id === currentId) || searchResults.find(i => i.id === currentId) || discoverResults.find(i => i.id === currentId);
        const bGenres = baseMedia?.genres || []; const baseTitle = baseMedia?.title.toLowerCase() || ""; const baseTitleFr = (baseMedia?.title_fr || "").toLowerCase();

        let dynamicPool = [...showsCache];

        if (baseTitle) {
            try {
                const cleanBase = baseTitle.replace(/[^a-zA-Z0-9 ]/g, "").split(' ').slice(0, 2).join(' ');
                const [tvRes, tmdbRes] = await Promise.all([
                    fetch(`${TVMAZE_API}/search/shows?q=${encodeURIComponent(cleanBase)}`).then(r => r.json()).catch(() => []),
                    fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(cleanBase)}`).then(r => r.json()).catch(() => ({ results: [] }))
                ]);

                if (Array.isArray(tvRes)) tvRes.forEach(item => { if (!dynamicPool.find(s => s.id === item.show.id)) dynamicPool.push(item.show); });
                if (tmdbRes.results) {
                    tmdbRes.results.forEach(m => {
                        if (m.media_type === 'movie' || m.media_type === 'tv') {
                            if (!dynamicPool.find(s => String(s.id) === String(m.id))) {
                                dynamicPool.push({
                                    id: m.id, name: m.title || m.name, type: m.media_type,
                                    premiered: m.release_date || m.first_air_date, image: { medium: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '' },
                                    genres: [], network: { name: 'Inconnu' }, rating: { average: m.vote_average || 0 }
                                });
                            }
                        }
                    });
                }
            } catch (e) {}
        }

        modalSuggestionsPool = dynamicPool.filter(s => `series-${s.id}` !== currentId && `movie-${s.id}` !== currentId).map(s => {
            let score = 0; const sTitle = s.name.toLowerCase();
            if (baseTitle && (sTitle.includes(baseTitle) || baseTitle.includes(sTitle))) score += 25;
            if (baseTitleFr && (sTitle.includes(baseTitleFr) || baseTitleFr.includes(sTitle))) score += 25;
            const bWords = baseTitle.split(/\s+/).filter(w => w.length > 3); bWords.forEach(w => { if (sTitle.includes(w)) score += 5; });
            let sharedGenres = 0; s.genres?.forEach(g => { if (bGenres.includes(g)) sharedGenres++; }); score += (sharedGenres * 4);
            if (preferredPlatforms.includes(s.network?.name)) score += 10; if (s.network?.name === baseMedia?.network && baseMedia?.network) score += 3;
            score += (s.rating?.average || 0);
            let matchPercent = Math.min(99, Math.max(40, Math.round(50 + (score * 1.5))));

            let norm;
            if (s.type === 'movie') norm = { id: `movie-${s.id}`, apiId: s.id, title: s.name, title_fr: s.name, type: 'movie', image: s.image?.medium || '', premiered: s.premiered ? String(s.premiered).split('-')[0] : 'N/A' };
            else norm = normalizeShow(s);
            return { ...norm, score, matchPercent };
        }).filter(i => i.matchPercent >= 75).sort((a, b) => b.matchPercent - a.matchPercent);

        modalSuggestionsPool = modalSuggestionsPool.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        modalSuggestionsPage = 1; document.getElementById('modalSuggestionsList').innerHTML = ''; appendSuggestions();
    } catch (e) {}
}

function appendSuggestions() {
    const list = document.getElementById('modalSuggestionsList'); const slice = modalSuggestionsPool.slice(0, 8);
    if (slice.length === 0 && modalSuggestionsPage === 1) { list.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Aucune suggestion avec un niveau de match suffisant (>= 75%).</p>'; return; }
    const frag = document.createDocumentFragment();
    slice.forEach(n => {
        const div = document.createElement('div'); div.className = 'bg-gray-900 border border-gray-700 p-2 rounded-xl flex gap-3 items-center';
        const displayTitle = n.title_fr || n.title; const optimizedThumb = getOptimizedImageUrl(n.image, 100);
        div.innerHTML = `<img data-src="${optimizedThumb}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onerror="this.onerror=null; this.src='${n.image}';" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})" class="w-12 h-16 object-cover rounded border border-gray-800 cursor-pointer lazy-image" /><div class="flex-1 min-w-0" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})"><h4 class="text-xs font-bold text-white truncate cursor-pointer">${displayTitle}</h4><div class="flex flex-col items-start gap-1 mt-1"><span class="text-[9px] text-gray-400 border border-gray-700 px-1 rounded">${n.premiered}</span><span class="text-[9px] font-black text-pink-400 bg-pink-900/40 px-1.5 py-0.5 rounded border border-pink-700/50 shadow-sm mt-0.5">Match ${n.matchPercent}%</span></div></div><div class="flex flex-col gap-1 w-24">${buildCardActionsHTML(n)}</div>`;
        frag.appendChild(div);
    });
    list.appendChild(frag); observeLazyImages();
}
