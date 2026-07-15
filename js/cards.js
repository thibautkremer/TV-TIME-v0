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

// Génère les boutons +Voir / ✓Vu pour les médias hors bibliothèque
function buildCardActionsHTML(media) {
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

// Suppression persistante avec Supabase
async function handleRemove(mediaId) {
    if (supabaseClient) {
        await supabaseClient.from('user_library').delete().eq('user_id', localUserId).eq('media_id', mediaId);
    }
    library = library.filter(i => i.id !== mediaId);
    rebuildLibraryIndex(); 
    saveLocalDB(); 
    refreshGrids(); 
    if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
}

// Logique spécifique Suivi : Mettre épisode suivant à Vu
async function checkNextEp(mediaId) {
    const item = libraryIndex.get(mediaId);
    if (!item || item.type !== 'series') return;
    const next = item.episodes.find(e => !e.watched && e.airdate && e.airdate <= todayString);
    if (next) {
        next.watched = true;
        item.last_modified = Date.now();
        await saveLocalDB(item);
        refreshGrids();
        if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
    }
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
    
    // Badge Match (Découverte uniquement)
    const matchBadge = (!isLib && !libItem && media.matchPercent && window.location.hash === '#discover') ? 
        `<div class="absolute bottom-1 left-1 bg-pink-900/90 text-pink-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-pink-700">${media.matchPercent}% Match</div>` : '';

    // Bouton "Vu" épisode (Page Suivi uniquement)
    let quickAction = '';
    if (isLib && libItem?.type === 'series') {
        const next = libItem.episodes?.find(e => !e.watched && e.airdate && e.airdate <= todayString);
        if (next) quickAction = `<button onclick="event.stopPropagation(); checkNextEp('${libItem.id}')" class="absolute bottom-1 right-1 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10">✔️ S${next.season}E${next.number}</button>`;
    }

    // Logique Boutons (Retirer sous titre OU +Voir/+Vu)
    let actionArea = '';
    if (libItem) {
        actionArea = `<button onclick="event.stopPropagation(); handleRemove('${m.id}')" class="w-full mt-2 text-center text-[10px] bg-gray-900 text-red-400 border border-red-900/50 py-1.5 rounded">Retirer</button>`;
    } else {
        actionArea = buildCardActionsHTML(media);
    }

    // Barre de progression
    let progressBar = '';
    if (libItem) {
        progressBar = `<div class="w-full h-1 bg-black/30"><div class="h-full bg-teal-400" style="width: ${getProgress(libItem)}%"></div></div>`;
    }

    div.innerHTML = `
        <div class="relative w-full">
            <img data-src="${getOptimizedImageUrl(m.image)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="media-poster lazy-image" />
            ${matchBadge}${quickAction}
        </div>
        <div class="p-2 flex flex-col flex-1">
            ${progressBar}
            <h3 class="font-bold text-white text-[10px] truncate leading-tight mt-1" title="${m.title_fr || m.title}">${m.title_fr || m.title || 'Inconnu'}</h3>
            <div class="mt-auto">${actionArea}</div>
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
