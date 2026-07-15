'use strict';

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

function createMediaCard(media, isLib = false) {
    const libItem = isMediaInLibrary(media);
    const m = libItem || media;
    
    // Point 7 : Couleurs (Violet: Anime, Bleu: Série, Rouge: Film)
    const isAnime = m.genres?.includes('Anime') || m.genres?.includes('Animation');
    const colorClass = m.type === 'movie' ? 'bg-red-900/40' : (isAnime ? 'bg-purple-900/40' : 'bg-blue-900/40');
    
    const div = document.createElement('div');
    div.className = `rounded-xl border border-gray-700 overflow-hidden cursor-pointer relative flex flex-col h-full ${colorClass}`;
    div.onclick = () => (isLib || libItem) ? openLibraryModal(m.id) : openPreviewModal(media);
    
    // Points 3 & 8 : Badge Match (seulement si non en lib) et bouton action suivi
    let matchBadge = (!isLib && !libItem && media.matchPercent) ? `<div class="absolute bottom-1 left-1 bg-pink-900/90 text-pink-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-pink-700">${media.matchPercent}% Match</div>` : '';
    let removeBtn = (isLib || libItem) ? `<button onclick="event.stopPropagation(); handleRemove('${m.id}')" class="absolute top-1 right-1 bg-black/70 text-red-500 text-[10px] font-black px-1.5 py-1 rounded z-10">✕</button>` : '';
    
    let quickAction = '';
    if (libItem && libItem.type === 'series') {
        const next = libItem.episodes?.find(e => !e.watched && e.airdate && e.airdate <= todayString);
        if (next) quickAction = `<button onclick="event.stopPropagation(); checkNextEp('${libItem.id}')" class="absolute bottom-1 right-1 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10">✓ E${next.number}</button>`;
    }

    div.innerHTML = `
        <div class="relative w-full">
            <img data-src="${getOptimizedImageUrl(m.image)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="media-poster lazy-image" />
            ${matchBadge}${removeBtn}${quickAction}
        </div>
        <div class="p-2 flex flex-col flex-1">
            <h3 class="font-bold text-white text-[10px] truncate" title="${m.title_fr || m.title}">${m.title_fr || m.title}</h3>
            ${!(isLib || libItem) ? `<div class="mt-auto pt-2">${buildCardActionsHTML(media)}</div>` : ''}
        </div>`;
    return div;
}

async function handleRemove(mediaId) {
    library = library.filter(i => i.id !== mediaId);
    rebuildLibraryIndex(); saveLocalDB(); refreshGrids();
}
