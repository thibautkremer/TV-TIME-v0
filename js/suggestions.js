'use strict';
// ============================================================
// SUGGESTIONS — Basé sur l'algorithme officiel de TMDB
// ============================================================

if (typeof window.suggestionsObserver === 'undefined') {
    window.suggestionsObserver = new IntersectionObserver(entries => { 
        if (entries[0].isIntersecting && modalSuggestionsPool.length > 0) { 
            modalSuggestionsPage++; appendSuggestions(); 
        } 
    });
}

async function renderSuggestions(currentId) {
    const block = document.getElementById('modalSuggestionsBlock');
    block.innerHTML = `<div id="modalSuggestionsList" class="space-y-2"><p class="text-xs text-teal-400 text-center py-4 animate-pulse">Chargement des recommandations...</p></div>`;
    
    try {
        const baseMedia = library.find(i => i.id === currentId) || searchResults.find(i => i.id === currentId) || discoverResults.find(i => i.id === currentId);
        if (!baseMedia) return;

        const endpoint = `${TMDB_BASE}/${baseMedia.type === 'series' ? 'tv' : 'movie'}/${baseMedia.apiId}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`;
        const res = await fetch(endpoint);
        const data = await res.json();
        
        let results = data.results || [];
        if (results.length === 0) {
            const similarRes = await fetch(`${TMDB_BASE}/${baseMedia.type === 'series' ? 'tv' : 'movie'}/${baseMedia.apiId}/similar?api_key=${TMDB_API_KEY}&language=fr-FR`);
            const similarData = await similarRes.json();
            results = similarData.results || [];
        }

        modalSuggestionsPool = results.map(m => ({
            id: baseMedia.type === 'series' ? `series-${m.id}` : `movie-${m.id}`,
            apiId: m.id,
            title: m.title || m.name,
            title_fr: m.title || m.name,
            type: baseMedia.type,
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
            premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
            rating: m.vote_average || 0,
            network: 'TMDB'
        })).filter(m => !isMediaInLibrary(m));

        modalSuggestionsPage = 1;
        document.getElementById('modalSuggestionsList').innerHTML = '';
        appendSuggestions();

    } catch (e) {
        document.getElementById('modalSuggestionsList').innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Pas de suggestions disponibles.</p>';
    }
}

function appendSuggestions() {
    const list = document.getElementById('modalSuggestionsList');
    const slice = modalSuggestionsPool.slice(0, 10);
    
    if (slice.length === 0) { 
        list.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Aucune suggestion trouvée pour ce média.</p>'; 
        return; 
    }
    
    const frag = document.createDocumentFragment();
    slice.forEach(n => {
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-700 p-2 rounded-xl flex gap-3 items-center hover:border-teal-700 transition';
        div.innerHTML = `
            <img src="${getOptimizedImageUrl(n.image, 100)}" class="w-12 h-16 object-cover rounded border border-gray-800" />
            <div class="flex-1 min-w-0 cursor-pointer" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})">
                <h4 class="text-xs font-bold text-white truncate">${n.title_fr}</h4>
                <div class="text-[9px] text-gray-400 mt-0.5">${n.premiered} • ★ ${n.rating.toFixed(1)}</div>
            </div>
            <div class="w-24">${buildCardActionsHTML(n)}</div>`;
        frag.appendChild(div);
    });
    list.appendChild(frag);
}
