'use strict';
// ============================================================
// MAIN — bootstrap asynchrone et gestes tactiles
// ============================================================

window.addEventListener('online', () => { loadFromCloud(); processSyncQueue(); });
window.addEventListener('offline', updateOfflineStatus);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(e => console.warn('Échec enregistrement Service Worker:', e));
    });
}

// ARCHITECTURE : Chargement asynchrone complet pour attendre IndexedDB
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Récupération de la base via IndexedDB avant d'afficher quoi que ce soit
    library = (await localforage.getItem('personal_tracker_db')) || [];
    rebuildLibraryIndex();
    deduplicateLibrary(); 
    updateHeaderCount();
    
    // 2. Synchronisation et mise à jour
    loadFromCloud().then(() => { checkAutoMassUpdate(); });
    processSyncQueue(); checkDailyNotifications();
    
    // 3. Observers
    const sSentinel = document.getElementById('searchSentinel'); if (sSentinel) window.searchObserver?.observe(sSentinel);
    const dSentinel = document.getElementById('discoverSentinel'); if (dSentinel) discoverObserver.observe(dSentinel);
    
    // 4. Initialisation interface
    switchTab('library');

    document.getElementById('modalViewSuggestionsBtn').onclick = () => {
        const block = document.getElementById('modalSuggestionsBlock');
        if (block.classList.contains('hidden')) { renderSuggestions(currentModalMediaId); block.classList.remove('hidden'); setTimeout(() => block.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); } else { block.classList.add('hidden'); }
    };

    // UX : Gestes tactiles pour fermer la modale
    let modalStartX = 0, modalEndX = 0;
    const modalEl = document.getElementById('mediaModal');
    modalEl.addEventListener('touchstart', e => { modalStartX = e.changedTouches[0].screenX; }, { passive: true });
    modalEl.addEventListener('touchend', e => { modalEndX = e.changedTouches[0].screenX; if (modalEndX - modalStartX > 100 && !modalEl.classList.contains('hidden')) closeModal(); }, { passive: true });

    // UX : NOUVEAU - Swipe Gestures pour naviguer entre les onglets
    setupTabSwiping();
});

function setupTabSwiping() {
    let touchstartX = 0;
    let touchendX = 0;
    const tabsList = ['search', 'discover', 'calendar', 'library', 'profile'];
    const mainContainer = document.getElementById('mainContainer');

    function handleGlobalSwipe() {
        if (!document.getElementById('mediaModal').classList.contains('hidden')) return;

        const diffX = touchstartX - touchendX;
        
        if (Math.abs(diffX) > 80) {
            const currentTab = tabsList.find(t => !document.getElementById(`tab-${t}`).classList.contains('hidden'));
            const currentIdx = tabsList.indexOf(currentTab);
            
            if (diffX > 0 && currentIdx < tabsList.length - 1) {
                switchTab(tabsList[currentIdx + 1]); 
            } else if (diffX < 0 && currentIdx > 0) {
                switchTab(tabsList[currentIdx - 1]); 
            }
        }
    }

    mainContainer.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, { passive: true });
    mainContainer.addEventListener('touchend', e => { touchendX = e.changedTouches[0].screenX; handleGlobalSwipe(); }, { passive: true });
}

async function checkAutoMassUpdate() {
    const lastUpdate = localStorage.getItem('last_mass_update_time');
    if (navigator.onLine && (!lastUpdate || (Date.now() - parseInt(lastUpdate)) > 10 * 24 * 60 * 60 * 1000)) {
        localStorage.setItem('last_mass_update_time', Date.now().toString());
        const statusEl = document.getElementById('cloudStatus');
        if (statusEl) { statusEl.textContent = '⏳ Auto-MAJ...'; statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-gray-900 text-yellow-400 rounded-full font-bold transition-colors shadow border border-yellow-900/50'; }
        await massUpdateLibrary('series', true); await massUpdateLibrary('movie', true);
        if (statusEl) { statusEl.textContent = '🟢 Cloud'; statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-gray-900 text-emerald-400 rounded-full font-bold transition-colors shadow border border-emerald-900/50'; }
        if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
        if (!document.getElementById('tab-profile').classList.contains('hidden')) renderProfile();
    }
}

function switchTab(name) {
    ['search', 'discover', 'calendar', 'library', 'profile'].forEach(t => { document.getElementById(`tab-${t}`).classList.add('hidden'); document.getElementById(`nav-${t}`).classList.replace('text-teal-400', 'text-gray-400'); document.getElementById(`nav-${t}`).classList.remove('font-bold'); });
    document.getElementById(`tab-${name}`).classList.remove('hidden'); document.getElementById(`nav-${name}`).classList.replace('text-gray-400', 'text-teal-400'); document.getElementById(`nav-${name}`).classList.add('font-bold');
    if (name === 'library') renderLibrary(); if (name === 'discover') renderDiscoverTab(); if (name === 'profile') renderProfile(); if (name === 'calendar') renderCalendar();
}
