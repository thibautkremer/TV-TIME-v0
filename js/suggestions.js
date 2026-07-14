'use strict';
// ============================================================
// SUGGESTIONS — Suggestions intelligentes basées sur TMDB
// ============================================================

const suggestionsObserver = new IntersectionObserver(entries => { 
    if (entries[0].isIntersecting && modalSuggestionsPool.length > 0) { 
        modalSuggestionsPage++; appendSuggestions(); 
    } 
});

async function renderSuggestions(currentId) {
    const block = document.getElementById('modalSuggestionsBlock');
    block.innerHTML = `<div id="modalSuggestionsList" class="space-y-2"><p class="text-xs text-teal-400 text-center py-4 animate-pulse">Recherche intelligente...</p></div>`;
    
    try {
        const baseMedia = library.find(i => i.id === currentId) || searchResults.find(i => i.id === currentId) || discoverResults.find(i => i.id === currentId);
        if (!baseMedia) return;

        // Appel API de recommandation officielle TMDB (beaucoup plus précis)
        const endpoint = `${TMDB_BASE}/${baseMedia.type === 'series' ? 'tv' : 'movie'}/${baseMedia.apiId}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR`;
        const res = await fetch(endpoint);
        const data = await res.json();
        
        modalSuggestionsPool = (data.results || []).map(m => ({
            id: baseMedia.type === 'series' ? `series-${m.id}` : `movie-${m.id}`,
            apiId: m.id,
            title: m.title || m.name,
            title_fr: m.title || m.name,
            type: baseMedia.type,
            image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
            premiered: (m.release_date || m.first_air_date || 'N/A').split('-')[0],
            rating: m.vote_average,
            matchPercent: Math.round(m.vote_average * 10) // Score basé sur la note TMDB
        })).filter(m => !isMediaInLibrary(m));

        modalSuggestionsPage = 1;
        document.getElementById('modalSuggestionsList').innerHTML = '';
        appendSuggestions();
    } catch (e) {
        document.getElementById('modalSuggestionsList').innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Aucune suggestion trouvée.</p>';
    }
}

function appendSuggestions() {
    const list = document.getElementById('modalSuggestionsList');
    const slice = modalSuggestionsPool.slice(0, 8);
    if (slice.length === 0) { list.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Aucune suggestion disponible.</p>'; return; }
    
    const frag = document.createDocumentFragment();
    slice.forEach(n => {
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-700 p-2 rounded-xl flex gap-3 items-center';
        div.innerHTML = `
            <img src="${getOptimizedImageUrl(n.image, 100)}" class="w-12 h-16 object-cover rounded border border-gray-800" />
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-white truncate">${n.title_fr}</h4>
                <span class="text-[9px] font-black text-pink-400 bg-pink-900/40 px-1.5 py-0.5 rounded border border-pink-700/50">${n.matchPercent}% Match</span>
            </div>
            <div class="w-24">${buildCardActionsHTML(n)}</div>`;
        frag.appendChild(div);
    });
    list.appendChild(frag);
}
