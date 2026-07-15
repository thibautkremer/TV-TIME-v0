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
        const baseMedia = libraryIndex.get(currentId) || searchResults.find(i => i.id === currentId) || discoverResults.find(i => i.id === currentId);
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
            rating: m.vote_average || 0
        }));

        modalSuggestionsPage = 1;
        appendSuggestions();

    } catch (e) {
        document.getElementById('modalSuggestionsList').innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Pas de suggestions disponibles.</p>';
    }
}

function appendSuggestions() {
    const list = document.getElementById('modalSuggestionsList');
    list.innerHTML = '';
    
    if (modalSuggestionsPool.length === 0) { 
        list.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Aucune suggestion trouvée.</p>'; 
        return; 
    }
    
    modalSuggestionsPool.slice(0, 10).forEach(n => {
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-700 p-2 rounded-xl flex gap-3 items-center hover:border-teal-700 transition';
        
        // Utilise buildCardActionsHTML pour gérer l'affichage conditionnel (Retirer vs Voir/Vu)
        div.innerHTML = `
            <img src="${getOptimizedImageUrl(n.image, 100)}" class="w-10 h-14 object-cover rounded cursor-pointer" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})" />
            <div class="flex-1 min-w-0 cursor-pointer" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})">
                <h4 class="text-[11px] font-bold text-white truncate">${n.title_fr || n.title || 'Inconnu'}</h4>
                <div class="text-[9px] text-gray-400">★ ${n.rating.toFixed(1)}</div>
            </div>
            <div class="w-24">${buildCardActionsHTML(n)}</div>`;
        list.appendChild(div);
    });
}
