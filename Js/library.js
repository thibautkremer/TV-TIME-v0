'use strict';
// ============================================================
// LIBRARY — onglet "Suivis" (bibliothèque personnelle)
// ============================================================

function applyGlobalFilter(type, value) { window.activeGlobalFilter = { type, value }; switchTab('library'); }
function clearGlobalFilter() { window.activeGlobalFilter = null; renderLibrary(); }

function resetLibFilters() {
    document.getElementById('librarySearch').value = ''; document.getElementById('clearLibSearchBtn').classList.add('hidden');
    document.getElementById('libraryTypeFilter').value = 'all'; document.getElementById('libraryStatusFilter').value = 'not_finished';
    document.getElementById('libraryDiffusionFilter').value = 'all'; document.getElementById('smartGenreFilter').value = 'all';
    document.getElementById('smartNetworkFilter').value = 'all'; document.getElementById('librarySortFilter').value = 'date_desc';
    clearGlobalFilter();
}

function renderLibrary() {
    const grid = document.getElementById('libraryGrid'); const filterIndicator = document.getElementById('globalFilterActive');
    if (window.activeGlobalFilter) {
        filterIndicator.classList.remove('hidden'); let txt = '';
        if (activeGlobalFilter.type === 'rating') txt = `Note : ${activeGlobalFilter.value}`; if (activeGlobalFilter.type === 'network') txt = `Plateforme : ${activeGlobalFilter.value}`; if (activeGlobalFilter.type === 'genre') txt = `Genre : ${activeGlobalFilter.value}`;
        document.getElementById('globalFilterText').textContent = txt;
    } else { filterIndicator.classList.add('hidden'); }

    const sFilter = document.getElementById('libraryStatusFilter').value; const tFilter = document.getElementById('libraryTypeFilter').value;
    const dFilter = document.getElementById('libraryDiffusionFilter').value; const gFilter = document.getElementById('smartGenreFilter').value;
    const nFilter = document.getElementById('smartNetworkFilter').value; const sortVal = document.getElementById('librarySortFilter').value;
    const searchInput = document.getElementById('librarySearch').value.toLowerCase().trim();

    grid.innerHTML = '';
    const ratingCache = new Map(); const getRatingCached = (item) => { let r = ratingCache.get(item.id); if (r === undefined) { r = getCalculatedRating(item); ratingCache.set(item.id, r); } return r; };
    const progressCache = new Map(); const getProgressCached = (item) => { let p = progressCache.get(item.id); if (p === undefined) { p = getProgress(item); progressCache.set(item.id, p); } return p; };

    let filtered = library.filter(item => {
        const title = (item.title || '').toLowerCase(); const titleFr = (item.title_fr || '').toLowerCase(); const iType = item.type || 'series'; const iStatus = item.status || 'In Progress';
        if (searchInput !== "" && !title.includes(searchInput) && !titleFr.includes(searchInput)) return false;

        if (window.activeGlobalFilter) {
            const { type, value } = window.activeGlobalFilter;
            if (type === 'rating') { const r = getRatingCached(item); if (value === '< 5') { if (r >= 5 || r === 0) return false; } else { if (Math.round(r * 2) / 2 !== parseFloat(value)) return false; } }
            if (type === 'network') { if (item.network !== value) return false; } if (type === 'genre') { if (!(item.genres || []).includes(value)) return false; }
        } else {
            if (tFilter !== 'all' && iType !== tFilter) return false; if (sFilter === 'not_finished' && iStatus !== 'In Progress') return false;
            if (sFilter === 'watched' && iStatus !== 'Watched') return false; if (sFilter === 'abandoned' && iStatus !== 'Abandoned') return false;
            if (gFilter !== 'all' && !(item.genres || []).includes(gFilter)) return false; if (nFilter !== 'all' && !(item.network || '').includes(nFilter)) return false;
            if (iType === 'series' && dFilter !== 'all') { const sp = (item.status_production || '').toLowerCase(); const isCanceled = sp.includes('cancel'); if (dFilter === 'canceled' && !isCanceled) return false; if (dFilter === 'running' && (isCanceled || !sp.includes('running'))) return false; if (dFilter === 'ended' && (isCanceled || (!sp.includes('ended') && !sp.includes('cancel')))) return false; }
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (sortVal === 'title_asc') return (a.title || '').localeCompare(b.title || ''); if (sortVal === 'title_desc') return (b.title || '').localeCompare(a.title || '');
        if (sortVal === 'date_desc') { const dateA = a.last_modified || a.addedAt || 0; const dateB = b.last_modified || b.addedAt || 0; if (dateA !== dateB) return dateB - dateA; const progA = getProgressCached(a); const progB = getProgressCached(b); if (progA !== progB) return progB - progA; return ((a.type || 'series') === 'series' ? 1 : 2) - ((b.type || 'series') === 'series' ? 1 : 2); }
        if (sortVal === 'date_asc') return (a.addedAt || a.last_modified || 0) - (b.addedAt || b.last_modified || 0);
        if (sortVal === 'rating_desc') return getRatingCached(b) - getRatingCached(a); if (sortVal === 'rating_asc') return getRatingCached(a) - getRatingCached(b);
        if (sortVal === 'prog_asc') { const progA = getProgressCached(a); const progB = getProgressCached(b); if (progA !== progB) return progA - progB; return ((a.type || 'series') === 'series' ? 1 : 2) - ((b.type || 'series') === 'series' ? 1 : 2); }
        const progA = getProgressCached(a); const progB = getProgressCached(b); if (progA !== progB) return progB - progA; return ((a.type || 'series') === 'series' ? 1 : 2) - ((b.type || 'series') === 'series' ? 1 : 2);
    });

    const frag = document.createDocumentFragment(); filtered.forEach(item => frag.appendChild(createMediaCard(item, true))); grid.appendChild(frag);
    if (filtered.length === 0) grid.innerHTML = '<p class="col-span-full text-center text-gray-500 text-sm py-10">Aucun résultat trouvé.</p>';
    observeLazyImages();
}
