'use strict';
// ============================================================
// LIBRARY — Affichage, filtrage et tri des médias suivis
// ============================================================

function renderLibrary() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;

    // 1. Récupération de tous les filtres actifs
    const query = (document.getElementById('librarySearch')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('libraryTypeFilter')?.value || 'all';
    const statusFilter = document.getElementById('libraryStatusFilter')?.value || 'all';
    const diffusionFilter = document.getElementById('libraryDiffusionFilter')?.value || 'all';
    const sortFilter = document.getElementById('librarySortFilter')?.value || 'date_desc';
    const genreFilter = document.getElementById('smartGenreFilter')?.value || 'all';
    const networkFilter = document.getElementById('smartNetworkFilter')?.value || 'all';

    // 2. Le filtrage "Pare-balles"
    let filtered = library.filter(item => {
        
        if (query) {
            const titleFr = (item.title_fr || '').toLowerCase();
            const titleVo = (item.title || '').toLowerCase();
            if (!titleFr.includes(query) && !titleVo.includes(query)) return false;
        }

        if (typeFilter !== 'all' && item.type !== typeFilter) return false;
        
        if (statusFilter !== 'all') {
            if (statusFilter === 'not_finished' && item.status !== 'In Progress') return false;
            if (statusFilter === 'watched' && item.status !== 'Watched') return false;
            if (statusFilter === 'abandoned' && item.status !== 'Abandoned') return false;
        }

        if (diffusionFilter !== 'all') {
            const prodStatus = (item.status_production || '').toLowerCase();
            if (diffusionFilter === 'running' && !prodStatus.includes('running')) return false;
            if (diffusionFilter === 'ended' && !prodStatus.includes('ended')) return false;
            if (diffusionFilter === 'canceled' && !prodStatus.includes('cancel')) return false;
        }

        if (genreFilter !== 'all') {
            if (!item.genres || !item.genres.includes(genreFilter)) return false;
        }

        if (networkFilter !== 'all') {
            if (!item.network || !item.network.includes(networkFilter)) return false;
        }

        // --- Filtre Global (depuis la page Profil) ---
        if (window.activeGlobalFilter) {
            if (window.activeGlobalFilter.type === 'genre' && (!item.genres || !item.genres.includes(window.activeGlobalFilter.value))) return false;
            if (window.activeGlobalFilter.type === 'network' && item.network !== window.activeGlobalFilter.value) return false;
            if (window.activeGlobalFilter.type === 'rating') {
                const rate = item.rating || 0;
                const [min, max] = window.activeGlobalFilter.value;
                if (rate < min || rate >= max) return false;
            }
        }

        return true; 
    });

    // 3. Tri des résultats
    filtered.sort((a, b) => {
        switch (sortFilter) {
            case 'date_desc': return (b.last_modified || 0) - (a.last_modified || 0);
            case 'date_asc': return (a.last_modified || 0) - (b.last_modified || 0);
            case 'title_asc': return (a.title_fr || a.title || '').localeCompare(b.title_fr || b.title || '');
            case 'title_desc': return (b.title_fr || b.title || '').localeCompare(a.title_fr || a.title || '');
            case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
            case 'rating_asc': return (a.rating || 0) - (b.rating || 0);
            case 'prog_desc': return (getProgress(b) || 0) - (getProgress(a) || 0);
            case 'prog_asc': return (getProgress(a) || 0) - (getProgress(b) || 0);
            default: return 0;
        }
    });

    // 4. Mise à jour de l'UI (Compteur)
    const countEl = document.getElementById('libCount');
    if (countEl) {
        countEl.textContent = filtered.length;
        countEl.classList.remove('hidden');
    }

    // 5. Rendu HTML
    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 font-bold text-sm bg-gray-800/50 rounded-xl border border-gray-700/50">Aucun média trouvé avec ces filtres.</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(item => {
        if (typeof createMediaCard === 'function') {
            frag.appendChild(createMediaCard(item, 'library'));
        }
    });
    grid.appendChild(frag);

    // CORRECTION 1 : Relancer le Lazy Load pour afficher les posters !
    if (typeof observeLazyImages === 'function') observeLazyImages();
}

// ============================================================
// OUTILS DE GESTION DES FILTRES
// ============================================================

function resetLibFilters() {
    const searchInput = document.getElementById('librarySearch');
    if (searchInput) searchInput.value = '';
    
    document.getElementById('libraryTypeFilter').value = 'all';
    document.getElementById('libraryStatusFilter').value = 'all'; 
    document.getElementById('libraryDiffusionFilter').value = 'all';
    document.getElementById('librarySortFilter').value = 'date_desc';
    document.getElementById('smartGenreFilter').value = 'all';
    document.getElementById('smartNetworkFilter').value = 'all';
    
    const clearBtn = document.getElementById('clearLibSearchBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    
    clearGlobalFilter(); 
}

function clearGlobalFilter() {
    window.activeGlobalFilter = null;
    const globalActiveEl = document.getElementById('globalFilterActive');
    if (globalActiveEl) globalActiveEl.classList.add('hidden');
    renderLibrary();
}

function setGlobalFilter(type, value, label) {
    window.activeGlobalFilter = { type, value };
    
    const textEl = document.getElementById('globalFilterText');
    const activeEl = document.getElementById('globalFilterActive');
    
    if (textEl) textEl.textContent = `Filtre actif : ${label}`;
    if (activeEl) activeEl.classList.remove('hidden');
    
    if (typeof switchTab === 'function') switchTab('library');
    renderLibrary();
}

// CORRECTION 2 : Pont pour la page Profil vers la page Suivi
window.applyGlobalFilter = function(type, value) {
    let parsedValue = value;
    // Si c'est une note, on la transforme en fourchette (ex: '7.5' devient [7.5, 8.0])
    if (type === 'rating') {
        if (value === '< 5') parsedValue = [0, 5];
        else parsedValue = [parseFloat(value), parseFloat(value) + 0.5];
    }
    setGlobalFilter(type, parsedValue, value);
};
