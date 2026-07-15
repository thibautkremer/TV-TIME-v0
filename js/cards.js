'use strict';
// ============================================================
// CARDS — Gestion unifiée des cartes (Display + Actions)
// ============================================================

function createSkeletonCard() {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm flex flex-col animate-pulse h-full';
    div.innerHTML = `<div class="w-full bg-gray-700" style="aspect-ratio: 155.88 / 217.56;"></div><div class="p-2 flex flex-col gap-2"><div class="h-3 bg-gray-600 rounded w-3/4"></div></div>`;
    return div;
}

function buildCardActionsHTML(media) {
    const libItem = isMediaInLibrary(media);
    if (libItem) {
        return `<button onclick="event.stopPropagation(); handleRemove('${libItem.id}')" class="w-full text-center text-[10px] bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-red-400 border border-red-900/50 py-1.5 rounded transition shadow-sm">✕ Retirer</button>`;
    }
    return `<div class="flex gap-1.5 w-full">
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', false)" class="flex-1 text-center text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold py-1.5 rounded transition shadow-sm">+ Voir</button>
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', true)" class="flex-1 text-center text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded transition shadow-sm">✓ Vu</button>
    </div>`;
}

async function handleQuickAdd(container, mediaId, watched) {
    container.innerHTML = `<span class="text-[9px] text-teal-400 py-1.5 font-bold animate-pulse w-full text-center block">Ajout...</span>`;
    await quickAdd(mediaId, watched); 
    const media = libraryIndex.get(mediaId);
    if(container.parentElement) container.parentElement.innerHTML = buildCardActionsHTML(media);
}

function createMediaCard(media, isLib = false) {
    const libItem = isMediaInLibrary(media);
    const div = document.createElement('div'); 
    div.className = 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer shadow-sm relative flex flex-col hover:border-gray-500 transition-colors h-full';
    div.onclick = () => (isLib || libItem) ? openLibraryModal(libItem ? libItem.id : media.id) : openPreviewModal(media);
    
    const calcRating = getCalculatedRating(media);
    const ratingOverlay = calcRating > 0 ? `<div class="absolute top-1 left-1 bg-black/70 text-yellow-400 text-[10px] font-black px-1.5 py-0.5 rounded z-10 border border-gray-800">★ ${calcRating.toFixed(1)}</div>` : '';
    const yearOverlay = media.premiered && media.premiered !== 'N/A' ? `<div class="absolute top-1 right-1 bg-gray-900/80 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded z-10 border border-gray-700">${String(media.premiered).split('-')[0]}</div>` : '';
    
    let progressBar = '';
    if (libItem) {
        const prog = getProgress(libItem);
        progressBar = `<div class="w-full h-1 bg-gray-900/80"><div class="h-full bg-teal-500" style="width: ${prog}%"></div></div>`;
    }

    div.innerHTML = `
        <div class="relative w-full">
            <img data-src="${getOptimizedImageUrl(media.image)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="media-poster bg-gray-900 lazy-image" />
            ${ratingOverlay}${yearOverlay}
        </div>
        <div class="p-2 flex-1 flex flex-col">
            ${progressBar}
            <h3 class="font-bold text-white text-[10px] truncate leading-tight mt-1" title="${media.title_fr || media.title}">${media.title_fr || media.title || 'Inconnu'}</h3>
            <div class="mt-auto pt-2">${buildCardActionsHTML(media)}</div>
        </div>`;
    return div;
}
