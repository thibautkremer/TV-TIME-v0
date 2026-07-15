'use strict';
// ============================================================
// LIBRARY — onglet "Suivis" (filtres, tri, rendu)
// ============================================================

function setupFiltersUI() {
    const typeSelect = document.getElementById('libraryTypeFilter');
    if (typeSelect && !typeSelect.querySelector('option[value="anime"]')) {
        const opt = document.createElement('option');
        opt.value = 'anime'; opt.textContent = 'Animes';
        typeSelect.insertBefore(opt, typeSelect.options[2]);
    }
    
    const sortSelect = document.getElementById('librarySortFilter');
    if (sortSelect && !sortSelect.querySelector('option[value="smart"]')) {
        const opt = document.createElement('option');
        opt.value = 'smart'; opt.textContent = 'Ordre Intelligent (Défaut)';
        sortSelect.insertBefore(opt, sortSelect.firstChild);
        if (!sortSelect.hasAttribute('data-initialized')) {
            sortSelect.value = 'smart';
            sortSelect.setAttribute('data-initialized', 'true');
        }
    }
}

function getSortTier(item) {
    if (item.status === 'Abandoned') return -1;
    const p = getProgress(item);
    if (p > 0 && p < 100) return 2; // En cours
    if (p === 0) return 1;          // Non commencé
    return 0;                       // Terminé
}

function renderLibrary() {
    setupFiltersUI();
    
    const typeFilter = document.getElementById('libraryTypeFilter').value;
    const statusFilter = document.getElementById('libraryStatusFilter').value;
    const diffusionFilter = document.getElementById('libraryDiffusionFilter').value;
    let sortVal = document.getElementById('librarySortFilter').value;
    if (!sortVal) sortVal = 'smart';
    const searchVal = document.getElementById('librarySearch').value.toLowerCase();
    const genreFilter = document.getElementById('smartGenreFilter').value;
    const netFilter = document.getElementById('smartNetworkFilter').value;

    let filtered = library.filter(i => {
        const isAnime = (i.genres || []).includes('Anime') || (i.genres || []).includes('Animation') || i.original_language === 'ja';
        
        if (typeFilter !== 'all') {
            if (typeFilter === 'anime' && !isAnime) return false;
            if (typeFilter === 'series' && (i.type !== 'series' || isAnime)) return false;
            if (typeFilter === 'movie' && i.type !== 'movie') return false;
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'not_finished' && (i.status === 'Watched' || i.status === 'Abandoned')) return false;
            if (statusFilter === 'watched' && i.status !== 'Watched') return false;
            if (statusFilter === 'abandoned' && i.status !== 'Abandoned') return false;
        }
        
        if (diffusionFilter !== 'all' && i.status_production?.toLowerCase() !== diffusionFilter.toLowerCase()) return false;
        if (genreFilter !== 'all' && !(i.genres || []).includes(genreFilter)) return false;
        if (netFilter !== 'all' && (i.network || 'Inconnu') !== netFilter) return false;
        if (searchVal && !(i.title?.toLowerCase().includes(searchVal) || i.title_fr?.toLowerCase().includes(searchVal))) return false;
        
        // Filtrage spécifique depuis le graphique de la page Profil
        if (window.activeGlobalFilter && window.activeGlobalFilter.type === 'rating') {
            const targetRating = window.activeGlobalFilter.value;
            const r = getCalculatedRating(i);
            if (r === 0) return false; // On ignore ceux qui n'ont pas de note
            if (targetRating === '< 5') {
                if (r >= 5) return false;
            } else {
                let rounded = Math.round(r * 2) / 2;
                let key = rounded.toFixed(1).replace('.0', '');
                if (key !== targetRating) return false;
            }
        }
        
        return true;
    });

    filtered.sort((a, b) => {
        if (sortVal === 'smart') {
            const typeA = a.type === 'movie' ? 1 : 0;
            const typeB = b.type === 'movie' ? 1 : 0;
            if (typeA !== typeB) return typeA - typeB; // Séries/Anime d'abord
            
            const tierA = getSortTier(a);
            const tierB = getSortTier(b);
            if (tierA !== tierB) return tierB - tierA; // Commencés > Non Commencés > Finis
            
            return (b.last_modified || 0) - (a.last_modified || 0); // Dernière activité
        }
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
    document.getElementById('librarySortFilter').value = 'smart';
    document.getElementById('smartGenreFilter').value = 'all';
    document.getElementById('smartNetworkFilter').value = 'all';
    document.getElementById('librarySearch').value = '';
    document.getElementById('clearLibSearchBtn').classList.add('hidden');
    window.activeGlobalFilter = null;
    document.getElementById('globalFilterActive').classList.add('hidden');
    renderLibrary();
}
