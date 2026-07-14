'use strict';
// ============================================================
// DB — persistance locale + synchronisation Supabase (cloud)
// ============================================================

function updateOfflineStatus() {
    const statusEl = document.getElementById('cloudStatus');
    const queueLen = syncQueue.length;
    statusEl.textContent = queueLen > 0 ? `🔴 Offline (${queueLen})` : '🔴 Hors-ligne';
    statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-red-900 text-red-400 rounded-full font-bold shadow border border-red-900/50';
}

function queueForSync(item) {
    const existingIdx = syncQueue.findIndex(i => i.id === item.id);
    if (existingIdx !== -1) syncQueue[existingIdx] = item; else syncQueue.push(item);
    localStorage.setItem('tv_time_sync_queue', JSON.stringify(syncQueue));
    updateOfflineStatus();
}

async function processSyncQueue() {
    if (!navigator.onLine || syncQueue.length === 0 || typeof supabaseClient === 'undefined') return;
    const statusEl = document.getElementById('cloudStatus');
    statusEl.textContent = '⏳ Sync bg...';
    try {
        const upsertData = syncQueue.map(item => ({ user_id: localUserId, media_id: item.id, media_data: item, last_modified: item.last_modified || Date.now() }));
        await supabaseClient.from('user_library').upsert(upsertData, { onConflict: 'user_id,media_id' });
        syncQueue = []; localStorage.setItem('tv_time_sync_queue', JSON.stringify([]));
        statusEl.textContent = '🟢 Cloud';
        statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-gray-900 text-emerald-400 rounded-full font-bold transition-colors shadow border border-emerald-900/50';
    } catch (e) { updateOfflineStatus(); }
}

async function saveLocalDB(syncItem = null) {
    try { localStorage.setItem('personal_tracker_db', JSON.stringify(library.slice(0, 50))); } catch (e) {}
    updateHeaderCount();
    if (syncItem && typeof supabaseClient !== 'undefined') {
        if (navigator.onLine) {
            try { await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: syncItem.id, media_data: syncItem, last_modified: syncItem.last_modified || Date.now() }, { onConflict: 'user_id,media_id' }); } catch (e) { queueForSync(syncItem); }
        } else { queueForSync(syncItem); }
    }
}

async function loadFromCloud() {
    if (!navigator.onLine) { updateOfflineStatus(); return; }
    const statusEl = document.getElementById('cloudStatus'); statusEl.textContent = '⏳ Check...';
    try {
        const { data, error } = await supabaseClient.from('user_library').select('media_data, media_id').eq('user_id', localUserId);
        if (data && data.length > 0) {
            const prefsRow = data.find(row => row.media_id === 'prefs_platforms');
            if (prefsRow && prefsRow.media_data && prefsRow.media_data.platforms) {
                preferredPlatforms = prefsRow.media_data.platforms;
                localStorage.setItem('preferred_platforms', JSON.stringify(preferredPlatforms));
            }
            library = data.filter(row => row.media_id !== 'prefs_platforms').map(row => row.media_data);
            rebuildLibraryIndex(); saveLocalDB(false);
            statusEl.textContent = '🟢 Cloud';
            statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-gray-900 text-emerald-400 rounded-full font-bold transition-colors shadow border border-emerald-900/50';
            if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
            if (!document.getElementById('tab-profile').classList.contains('hidden')) renderProfile();
        } else {
            statusEl.textContent = '🟢 Cloud';
            statusEl.className = 'cursor-pointer text-[10px] px-2 py-0.5 bg-gray-900 text-emerald-400 rounded-full font-bold transition-colors shadow border border-emerald-900/50';
        }
    } catch (e) { statusEl.textContent = '🔴 Erreur Sync'; }
}

async function forceSync() { await loadFromCloud(); processSyncQueue(); }

function deduplicateLibrary() {
    const unique = []; const seen = new Set();
    library.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0));
    for (const item of library) { if (item && item.id && item.title && !seen.has(item.id)) { seen.add(item.id); unique.push(item); } }
    library = unique; rebuildLibraryIndex();
}

function updateHeaderCount() {
    const el = document.getElementById('libCount');
    if (library.length > 0) { el.textContent = library.length; el.classList.remove('hidden'); } else el.classList.add('hidden');
}

function clearAll() {
    if (!confirm('Vider le cache local ? La sauvegarde Cloud restera intacte.')) return;
    library = []; rebuildLibraryIndex(); localStorage.removeItem('personal_tracker_db'); renderLibrary(); renderProfile();
}

function exportLibrary() {
    if (library.length === 0) { alert("Rien à exporter."); return; }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(library, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr); downloadAnchorNode.setAttribute("download", "tv_time_backup.json");
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
}

async function importLibrary(event) {
    const files = event.target.files; if (!files.length) return; alert("Import en cours... Ne fermez pas la page.");
    for (let file of files) {
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            try {
                const data = JSON.parse(text);
                for (let raw of data) {
                    const idx = library.findIndex(x => x.id === raw.id || x.title === raw.title);
                    if (idx !== -1) library[idx] = { ...library[idx], ...raw, last_modified: Date.now() }; else library.push({ ...raw, last_modified: Date.now() });
                    if (supabaseClient) { await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: raw.id, media_data: raw, last_modified: Date.now() }, { onConflict: 'user_id, media_id' }); }
                }
            } catch (err) { alert('Erreur JSON sur ' + file.name); }
        }
    }
    rebuildLibraryIndex(); renderProfile(); renderLibrary(); alert("Import et synchronisation Cloud terminés !");
}
