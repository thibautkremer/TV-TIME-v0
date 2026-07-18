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

function buildCardActionsHTML(media) {
    return `<div class="flex gap-1.5 w-full">
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', false)" class="flex-1 text-center text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold py-1.5 rounded transition shadow-sm">+ Voir</button>
        <button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', true)" class="flex-1 text-center text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded transition shadow-sm">✓ Vu</button>
    </div>`;
}

async function handleQuickAdd(container, mediaId, watched) {
    container.innerHTML = `<span class="text-[9px] text-teal-400 font-bold w-full text-center block">Ajout...</span>`;
    await quickAdd(mediaId, watched); 
    if (typeof processSyncQueue === 'function') processSyncQueue(); 
    refreshGrids();
}

async function handleRemove(mediaId) {
    if (typeof supabaseClient !== 'undefined') {
        await supabaseClient.from('user_library').delete().eq('user_id', localUserId).eq('media_id', mediaId);
    }
    library = library.filter(i => i.id !== mediaId);
    rebuildLibraryIndex(); 
    saveLocalDB(); 
    refreshGrids(); 
    if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
}

async function checkNextEp(mediaId) {
    const item = libraryIndex.get(mediaId);
    if (!item || item.type !== 'series' || !item.episodes) return;
    
    const nextIndex = item.episodes.findIndex(e => !e.watched && e.airdate && e.airdate <= todayString);
    
    if (nextIndex !== -1) {
        for (let i = 0; i <= nextIndex; i++) {
            item.episodes[i].watched = true;
        }
        
        const allAiredWatched = item.episodes.every(e => e.watched || (!e.airdate || e.airdate > todayString));
        item.status = allAiredWatched ? 'Watched' : 'In Progress';
        item.last_modified = Date.now();
        
        await saveLocalDB(item);
        
        if (typeof processSyncQueue === 'function') processSyncQueue(); 
        
        refreshGrids();
        if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
    }
}

function createMediaCard(media, context = 'library') {
    const libItem = isMediaInLibrary(media);
    const m = libItem || media;
    
    // Utilisation de la nouvelle logique Anime globale
    const isAnime = (m.genres || []).includes('Anime') || (m.genres || []).includes('Animation') || m.original_language === 'ja';
    const colorClass = m.type === 'movie' ? 'bg-red-900/40' : (isAnime ? 'bg-purple-900/40' : 'bg-blue-900/40');
    
    const div = document.createElement('div');
    div.className = `rounded-xl border border-gray-700 overflow-hidden cursor-pointer relative flex flex-col h-full ${colorClass}`;
    div.onclick = () => (context === 'library' || libItem) ? openLibraryModal(m.id) : openPreviewModal(media);
    
    let topLeft = '', topRight = '', bottomLeft = '', bottomRight = '';
    
    const rating = getCalculatedRating(m);
    if (rating > 0) {
        topLeft = `<div class="absolute top-1 left-1 bg-black/70 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded z-10 border border-yellow-700/50 shadow">★ ${rating.toFixed(1)}</div>`;
    }
    
    // Affichage de l'année uniquement
    let displayYear = 'N/A';
    if (m.releaseDate) {
        displayYear = m.releaseDate.substring(0,4);
    } else if (m.premiered && m.premiered !== 'N/A') {
         displayYear = m.premiered.substring(0,4);
    }

    if (['search', 'discover'].includes(context)) {
        if (displayYear !== 'N/A') {
            topRight = `<div class="absolute top-1 right-1 bg-black/70 text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded z-10 border border-gray-700/50 shadow">${displayYear}</div>`;
        }
    }

    if (context === 'discover' && !libItem && media.matchPercent) {
        bottomLeft = `<div class="absolute bottom-1 left-1 bg-pink-900/90 text-pink-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-pink-700 shadow">${media.matchPercent}%</div>`;
    }

    if (context === 'library') {
        topRight = `<button onclick="event.stopPropagation(); handleRemove('${m.id}')" class="absolute top-1 right-1 text-red-500 hover:text-red-400 text-lg font-black z-10 flex items-center justify-center transition drop-shadow-md">✕</button>`;
        
        if (m.type === 'series') {
            const s = (m.status_production || '').toLowerCase();
            if (s.includes('cancel') || s.includes('annulé') || s.includes('canceled')) {
                bottomLeft = `<div class="absolute bottom-1 left-1 bg-red-900/90 text-red-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-red-700 shadow">Annulée</div>`;
            }
            
            const next = m.episodes && m.episodes.find(e => !e.watched && e.airdate && e.airdate <= todayString);
            if (next) {
                bottomRight = `<button onclick="event.stopPropagation(); checkNextEp('${m.id}')" class="absolute bottom-1 right-1 bg-teal-600 hover:bg-teal-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10 shadow transition">✔️ S${next.season}E${next.number}</button>`;
            }
        }
    }

    let actionArea = '';
    if (context !== 'library') {
        if (libItem) {
            actionArea = `<button onclick="event.stopPropagation(); handleRemove('${m.id}')" class="w-full mt-2 text-center text-[10px] bg-gray-900 text-red-400 border border-red-900/50 py-1.5 rounded transition">Retirer</button>`;
        } else {
            actionArea = buildCardActionsHTML(media);
        }
    }

    let progressBar = '';
    if (libItem) {
        progressBar = `<div class="w-full h-1 bg-black/40 rounded-full overflow-hidden ${context === 'library' ? 'mb-1.5' : 'mb-0'}"><div class="h-full bg-teal-400" style="width: ${getProgress(libItem)}%"></div></div>`;
    }

    div.innerHTML = `
        <div class="relative w-full">
            <img data-src="${getOptimizedImageUrl(m.image)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="media-poster lazy-image" />
            ${topLeft}${topRight}${bottomLeft}${bottomRight}
        </div>
        <div class="p-2 flex flex-col flex-1 justify-end">
            ${context === 'library' ? progressBar : ''}
            <h3 class="font-bold text-white text-[10px] truncate leading-tight" title="${m.title_fr || m.title}">${m.title_fr || m.title || 'Inconnu'}</h3>
            ${context !== 'library' && libItem ? `<div class="mt-1">${progressBar}</div>` : ''}
            ${actionArea ? `<div class="${context !== 'library' && libItem ? 'mt-1' : 'mt-auto'}">${actionArea}</div>` : ''}
        </div>`;
    
    return div;
}

function refreshGrids() {
    const grids = [
        { id: 'searchResults', arr: searchResults, type: currentMediaType, ctx: 'search' },
        { id: 'discoverGrid', arr: discoverResults, type: discoverMediaType, ctx: 'discover' }
    ];
    
    grids.forEach(g => {
        const el = document.getElementById(g.id);
        if (el && !el.parentElement.classList.contains('hidden')) {
            el.innerHTML = '';
            const filtered = g.arr.filter(r => r.type === g.type);
            const frag = document.createDocumentFragment();
            filtered.forEach(m => frag.appendChild(createMediaCard(m, g.ctx))); 
            el.appendChild(frag);
        }
    });
    observeLazyImages();
}
