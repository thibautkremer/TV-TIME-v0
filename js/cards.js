'use strict';
// ============================================================
// CARDS — carte média réutilisée et Skeletons
// ============================================================

// UX : Fonction pour générer une carte de chargement animée (Skeleton)
function createSkeletonCard() {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm flex flex-col animate-pulse h-full';
    div.innerHTML = `
        <div class="w-full bg-gray-700" style="aspect-ratio: 155.88 / 217.56;"></div>
        <div class="p-2 flex-1 flex flex-col gap-2">
            <div class="h-3 bg-gray-600 rounded w-3/4 mt-1"></div>
            <div class="h-3 bg-gray-600 rounded w-1/2"></div>
            <div class="mt-auto pt-1 flex gap-1.5 w-full">
                <div class="flex-1 h-6 bg-gray-700 rounded"></div>
            </div>
        </div>`;
    return div;
}

// Remplace buildCardActionsHTML dans js/cards.js
function buildCardActionsHTML(media) {
    const libItem = isMediaInLibrary(media);
    if (libItem) return `<button onclick="event.stopPropagation(); handleRemove('${libItem.id}')" class="w-full text-center text-[10px] bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-red-400 border border-gray-700 py-1.5 rounded transition shadow-sm">✕ Retirer</button>`;
    return `<div class="flex gap-1.5 w-full"><button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', false)" class="flex-1 text-center text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-bold py-1.5 rounded transition shadow-sm">+ Voir</button><button onclick="event.stopPropagation(); handleQuickAdd(this.parentElement.parentElement, '${media.id}', true)" class="flex-1 text-center text-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded transition shadow-sm">✓ Vu</button></div>`;
}


async function handleRemove(mediaId) {
    if (supabaseClient) { try { await supabaseClient.from('user_library').delete().eq('user_id', localUserId).eq('media_id', mediaId); } catch (e) {} }
    library = library.filter(i => i.id !== mediaId); rebuildLibraryIndex(); saveLocalDB();
    refreshGrids(); if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary(); renderProfile();
}

async function handleQuickAdd(container, mediaId, watched) {
    container.innerHTML = `<span class="text-[9px] text-teal-400 py-1.5 font-bold animate-pulse w-full text-center block">Ajout...</span>`;
    await quickAdd(mediaId, watched); refreshGrids();
}

function checkNextEp(id) {
    const item = library.find(i => i.id === id); if (!item) return;
    const nextEp = item.episodes?.find(e => !e.watched && e.airdate && e.airdate <= todayString);
    if (nextEp) {
        const idx = item.episodes.indexOf(nextEp);
        for (let i = 0; i <= idx; i++) item.episodes[i].watched = true;
        item.status = item.episodes.every(e => e.watched || !e.airdate || e.airdate > todayString) ? 'Watched' : 'In Progress';
        item.last_modified = Date.now(); saveLocalDB(item); renderLibrary();
    }
}

function resetToUnwatched(id) {
    const item = library.find(i => i.id === id); if (!item) return;
    if (item.type === 'series') item.episodes?.forEach(e => e.watched = false);
    item.status = 'In Progress'; item.last_modified = Date.now(); saveLocalDB(item); renderLibrary();
}

function markMovieWatched(id) {
    const item = library.find(i => i.id === id); if (!item) return;
    item.status = 'Watched'; item.last_modified = Date.now(); saveLocalDB(item); renderLibrary();
}

function createMediaCard(media, isLib = false) {
    const isAnime = media.genres?.includes('Anime') || media.genres?.includes('Animation');
    const bgColorClass = media.type === 'movie' ? 'bg-amber-900/60' : (isAnime ? 'bg-purple-900/60' : 'bg-teal-900/60');
    const barColorClass = media.type === 'movie' ? 'bg-amber-500' : (isAnime ? 'bg-purple-500' : 'bg-teal-500');
    const div = document.createElement('div'); div.className = 'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer shadow-sm relative flex flex-col hover:border-gray-500 transition-colors h-full';
    const libItem = isMediaInLibrary(media);
    div.onclick = (e) => { if (e.target.closest('button')) return; if (isLib || libItem) openLibraryModal(libItem ? libItem.id : media.id); else openPreviewModal(media); };
    const optimizedImgSrc = getOptimizedImageUrl(media.image, 300);
    const calcRating = getCalculatedRating(media); const ratingDisplay = calcRating > 0 ? calcRating.toFixed(1) : 'N/A';
    const ratingOverlay = `<div class="absolute top-1 left-1 bg-black/70 text-yellow-400 text-[10px] font-black px-1.5 py-0.5 rounded z-10 border border-gray-800">★ ${ratingDisplay}</div>`;
    let yearOverlay = ''; if (!isLib && media.premiered && media.premiered !== 'N/A') { const year = String(media.premiered).split('-')[0]; yearOverlay = `<div class="absolute top-1 right-1 bg-gray-900/80 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded z-10 border border-gray-700">${year}</div>`; }
    const removeBtn = isLib ? `<button onclick="event.stopPropagation(); handleRemove('${media.id}')" class="absolute top-1 right-1 bg-black/70 text-red-500 text-[10px] font-black px-1.5 py-0.5 rounded z-10 border border-gray-800 hover:bg-red-900">✕</button>` : '';
    let libOverlay = '';
    if (isLib) {
        if (media.type === 'series') {
            const nextEp = media.episodes?.find(e => !e.watched && e.airdate && e.airdate <= todayString);
            if (media.status === 'Watched') libOverlay = `<button onclick="event.stopPropagation(); resetToUnwatched('${media.id}')" class="absolute bottom-1 right-1 bg-black/70 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-black z-10">↺</button>`;
            else if (nextEp) libOverlay = `<button onclick="event.stopPropagation(); checkNextEp('${media.id}')" class="absolute bottom-1 right-1 bg-teal-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10">✓ S${nextEp.season}E${nextEp.number}</button>`;
        } else if (media.type === 'movie') {
            if (media.status === 'Watched') libOverlay = `<button onclick="event.stopPropagation(); resetToUnwatched('${media.id}')" class="absolute bottom-1 right-1 bg-black/70 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-black z-10">↺</button>`;
            else libOverlay = `<button onclick="event.stopPropagation(); markMovieWatched('${media.id}')" class="absolute bottom-1 right-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black z-10">✓ Vu</button>`;
        }
    }
    let matchBadge = media.matchPercent ? `<div class="absolute bottom-1 left-1 bg-pink-900/90 text-pink-300 text-[9px] font-black px-1.5 py-0.5 rounded z-10 border border-pink-700 shadow-sm">${media.matchPercent}% Match</div>` : '';
    const displayTitle = media.title_fr || media.title || 'Inconnu';
    let progressBarHtml = ''; if (isLib) { const prog = getProgress(media); progressBarHtml = `<div class="w-full h-1 bg-gray-900/80 rounded-full overflow-hidden mb-1.5 shadow-inner"><div class="h-full ${barColorClass} transition-all duration-500" style="width: ${prog}%"></div></div>`; }
    div.innerHTML = `<div class="relative w-full"><img data-src="${optimizedImgSrc}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onerror="this.onerror=null; this.src='${media.image}';" class="media-poster bg-gray-900 lazy-image" />${ratingOverlay}${yearOverlay}${removeBtn}${libOverlay}${matchBadge}</div><div class="p-2 flex-1 flex flex-col ${isLib ? bgColorClass : 'bg-gray-800'}">${progressBarHtml}<h3 class="font-bold text-white text-[11px] truncate leading-tight" title="${displayTitle}">${displayTitle}</h3>${!isLib ? `<div class="mt-auto pt-1" id="actions-${media.id}">${buildCardActionsHTML(media, libItem)}</div>` : ''}</div>`;
    return div;
}

function refreshGrids() {
    if (!document.getElementById('tab-search').classList.contains('hidden')) {
        const container = document.getElementById('searchResults'); container.innerHTML = '';
        const filtered = searchResults.filter(r => r.type === currentMediaType);
        const frag = document.createDocumentFragment();
        filtered.slice(0, searchPage * PAGE_SIZE).forEach(m => frag.appendChild(createMediaCard(m, false))); container.appendChild(frag);
    }
    if (!document.getElementById('tab-discover').classList.contains('hidden')) {
        const container = document.getElementById('discoverGrid'); container.innerHTML = '';
        const frag = document.createDocumentFragment();
        discoverResults.slice(0, discoverPage * PAGE_SIZE).forEach(m => frag.appendChild(createMediaCard(m, false))); container.appendChild(frag);
    }
    observeLazyImages();
}
