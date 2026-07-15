'use strict';
// ============================================================
// CARDS — Rendu unifié des cartes médias et actions
// ============================================================

function createSkeletonCard() {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm flex flex-col animate-pulse h-full';
    div.innerHTML = `<div class="w-full bg-gray-700" style="aspect-ratio: 155.88 / 217.56;"></div><div class="p-2 flex flex-col gap-2"><div class="h-3 bg-gray-600 rounded w-3/4"></div></div>`;
    return div;
}

// Génère le bouton d'action selon si le média est présent ou non
function buildCardActionsHTML(media) {
    const libItem = isMediaInLibrary(media);
    if (libItem) {
        return `<button onclick="event.stopPropagation(); handleRemove('${libItem.id}')" class="w-full text-center text-[10px] bg-gray-900 hover:bg-gray-800 text-red-400 border border-red-900/50 py-1.5 rounded transition shadow-sm">✕ Retirer</button>`;
    }
    return `<div class="flex gap-1.5 w-full">
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', false)" class="flex-1 text-center text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold py-1.5 rounded transition shadow-sm">+ Voir</button>
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', true)" class="flex-1 text-center text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded transition shadow-sm">✓ Vu</button>
    </div>`;
}

async function handleQuickAdd(container, mediaId, watched) {
    container.innerHTML = `<span class="text-[9px] text-teal-400 font-bold w-full text-center block">Ajout...</span>`;
    await quickAdd(mediaId, watched); 
    refreshGrids();
}

async function handleRemove(mediaId) {
    library = library.filter(i => i.id !== mediaId);
    rebuildLibraryIndex(); 
    saveLocalDB(); 
    refreshGrids(); 
    if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
}

function createMediaCard(media, isLib = false) {
    const libItem = isMediaInLibrary(media);
    const m = libItem || media;
    
    // Codes couleurs: Violet (Anime), Bleu (Série), Rouge (Film)
    const isAnime = m.genres?.includes('Anime') || m.genres?.includes('Animation');
    const colorClass = m.type === 'movie' ? 'bg-red-900/40' : (isAnime ? 'bg-purple-900/40' : 'bg-blue-900/40');
    
    const div = document.createElement('div');
    div.className = `rounded-xl border border-gray-700 overflow-hidden cursor-pointer relative flex flex-col h-full ${colorClass}`;
    div.onclick = () => (isLib || libItem) ? openLibraryModal(m.id) : openPreviewModal(media);
    
    // Note dorée (Haut gauche)
    const calcRating = getCalculatedRating(m);
    const ratingOverlay = calcRating > 0 ? `<div class="absolute top-1 left-1 bg-black/70 text-yellow-400 text-[10px] font-black px-1.5 py-0.5 rounded z-10 border border-gray-800">★ ${calcRating.toFixed(1)}</div>` : '';
    
    // Bouton Retirer (Haut droite)
    const removeBtn = (libItem) ? `<button onclick="event.stopPropagation(); handleRemove('${m.id}')" class="absolute top-1 right-1 bg-black/70 text-red-500 text-[10px] font-black px-1.5 py-1 rounded z-10">✕</button>` : '';
    
    // Bouton "Vu" épisode en cours (Bas droite format ✔️ SxE)
    let quickAction = '';
    if (libItem && libItem.type === 'series') {
        const next = libItem.episodes?.find(e => !e.watched && e.airdate && e.airdate <= todayString);
        if (next) quickAction = `<button onclick="event.stopPropagation(); checkNextEp('${libItem.id}')" class="absolute bottom-1 right-1 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10">✔️ S${next.season}E${next.number}</button>`;
    }
    
    // Badge Match (si non en lib)
    const matchBadge = (!libItem && media.matchPercent) ? `<div class="absolute bottom-1 left-1 bg-pink-900/90 text-pink-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-pink-700">${media.matchPercent}% Match</div>` : '';

    div.innerHTML = `
        <div class="relative w-full">
            <img data-src="${getOptimizedImageUrl(m.image)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="media-poster lazy-image" />
            ${ratingOverlay}${matchBadge}${removeBtn}${quickAction}
        </div>
        <div class="p-2 flex flex-col flex-1">
            <h3 class="font-bold text-white text-[10px] truncate leading-tight mt-1" title="${m.title_fr || m.title}">${m.title_fr || m.title || 'Inconnu'}</h3>
            ${!libItem ? `<div class="mt-auto pt-2">${buildCardActionsHTML(media)}</div>` : ''}
        </div>`;
    return div;
}

function refreshGrids() {
    const grids = [
        { id: 'searchResults', arr: searchResults, type: currentMediaType },
        { id: 'discoverGrid', arr: discoverResults, type: discoverMediaType }
    ];
    
    grids.forEach(g => {
        const el = document.getElementById(g.id);
        if (el && !el.parentElement.classList.contains('hidden')) {
            el.innerHTML = '';
            const filtered = g.arr.filter(r => r.type === g.type);
            const frag = document.createDocumentFragment();
            filtered.forEach(m => frag.appendChild(createMediaCard(m, false))); 
            el.appendChild(frag);
        }
    });
    observeLazyImages();
}
