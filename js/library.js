'use strict';
// ============================================================
// LIBRARY — onglet "Suivis" (filtres, tri, rendu)
// ============================================================

function renderLibrary() {
    const typeFilter = document.getElementById('libraryTypeFilter').value;
    const statusFilter = document.getElementById('libraryStatusFilter').value;
    const diffusionFilter = document.getElementById('libraryDiffusionFilter').value;
    const sortVal = document.getElementById('librarySortFilter').value;
    const searchVal = document.getElementById('librarySearch').value.toLowerCase();
    const genreFilter = document.getElementById('smartGenreFilter').value;
    const netFilter = document.getElementById('smartNetworkFilter').value;

    let filtered = library.filter(i => {
        if (typeFilter !== 'all' && i.type !== typeFilter) return false;
        if (statusFilter !== 'all') {
            if (statusFilter === 'not_finished' && (i.status === 'Watched' || i.status === 'Abandoned')) return false;
            if (statusFilter === 'watched' && i.status !== 'Watched') return false;
            if (statusFilter === 'abandoned' && i.status !== 'Abandoned') return false;
        }
        if (diffusionFilter !== 'all' && i.status_production?.toLowerCase() !== diffusionFilter.toLowerCase()) return false;
        if (genreFilter !== 'all' && !(i.genres || []).includes(genreFilter)) return false;
        if (netFilter !== 'all' && (i.network || 'Inconnu') !== netFilter) return false;
        if (searchVal && !(i.title?.toLowerCase().includes(searchVal) || i.title_fr?.toLowerCase().includes(searchVal))) return false;
        return true;
    });

    // Tri : Point 5 - Activité récente par défaut
    filtered.sort((a, b) => {
        if (sortVal === 'date_desc') return (b.last_modified || 0) - (a.last_modified || 0);
        if (sortVal === 'prog_desc') return getProgress(b) - getProgress(a);
        if (sortVal === 'prog_asc') return getProgress(a) - getProgress(b);
        if (sortVal === 'title_asc') return (a.title_fr || a.title || '').localeCompare(b.title_fr || b.title || '');
        if (sortVal === 'title_desc') return (b.title_fr || b.title || '').localeCompare(a.title_fr || a.title || '');
        if (sortVal === 'date_asc') return (a.addedAt || 0) - (b.addedAt || 0);
        if (sortVal === 'rating_desc') return getCalculatedRating(b) - getCalculatedRating(a);
        if (sortVal === 'rating_asc') return getCalculatedRating(a) - getCalculatedRating(b);
        return 0;
    });

    const container = document.getElementById('libraryGrid');
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    filtered.forEach(m => frag.appendChild(createMediaCard(m, 'library')));
    container.appendChild(frag);
    observeLazyImages();
}

function applyGlobalFilter(type, value) {
    window.activeGlobalFilter = { type, value };
    document.getElementById('globalFilterActive').classList.remove('hidden');
    document.getElementById('globalFilterText').textContent = `${type}: ${value}`;
    
    // Application automatique des filtres
    if (type === 'genre') document.getElementById('smartGenreFilter').value = value;
    if (type === 'network') document.getElementById('smartNetworkFilter').value = value;
    renderLibrary();
    switchTab('library');
}

function clearGlobalFilter() {
    window.activeGlobalFilter = null;
    document.getElementById('globalFilterActive').classList.add('hidden');
    document.getElementById('smartGenreFilter').value = 'all';
    document.getElementById('smartNetworkFilter').value = 'all';
    renderLibrary();
}

function resetLibFilters() {
    document.getElementById('libraryTypeFilter').value = 'all';
    document.getElementById('libraryStatusFilter').value = 'not_finished';
    document.getElementById('libraryDiffusionFilter').value = 'all';
    document.getElementById('librarySortFilter').value = 'date_desc';
    document.getElementById('smartGenreFilter').value = 'all';
    document.getElementById('smartNetworkFilter').value = 'all';
    document.getElementById('librarySearch').value = '';
    document.getElementById('clearLibSearchBtn').classList.add('hidden');
    renderLibrary();
}
