'use strict';
// ============================================================
// PROFILE — onglet "Profil" (statistiques et préférences)
// ============================================================

function renderAdminPlatforms() {
    const counts = {}; library.forEach(i => { if (i.network && i.network !== 'Inconnu') { counts[i.network] = (counts[i.network] || 0) + 1; } });
    const platforms = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    document.getElementById('adminPlatformList').innerHTML = platforms.map(p => {
        const isSelected = preferredPlatforms.includes(p);
        const activeClass = "flex items-center gap-1 cursor-pointer text-xs bg-gray-800 px-2 py-1 rounded border border-teal-500 text-teal-400";
        const inactiveClass = "flex items-center gap-1 cursor-pointer text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-400";
        return `<label class="${isSelected ? activeClass : inactiveClass}"><input type="checkbox" value="${p}" class="hidden pref-platform-checkbox" ${isSelected ? 'checked' : ''} onchange="this.parentElement.className = this.checked ? '${activeClass}' : '${inactiveClass}'"> ${p} <span class="text-[9px] opacity-60">(${counts[p]})</span></label>`;
    }).join('');
}

async function savePlatformPrefs() {
    const checkboxes = document.querySelectorAll('.pref-platform-checkbox');
    preferredPlatforms = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
    localStorage.setItem('preferred_platforms', JSON.stringify(preferredPlatforms));
    if (typeof supabaseClient !== 'undefined' && navigator.onLine) {
        try { await supabaseClient.from('user_library').upsert({ user_id: localUserId, media_id: 'prefs_platforms', media_data: { id: 'prefs_platforms', platforms: preferredPlatforms }, last_modified: Date.now() }, { onConflict: 'user_id,media_id' }); } catch (e) {}
    }
    alert('Préférences de plateformes enregistrées et synchronisées sur le Cloud !');
}

function renderProfile() {
    renderAdminPlatforms();
    const series = library.filter(i => i.type === 'series' && !(i.genres || []).includes('Anime') && !(i.genres || []).includes('Animation'));
    const animes = library.filter(i => (i.genres || []).includes('Anime') || (i.genres || []).includes('Animation'));
    const movies = library.filter(i => i.type === 'movie');
    let watchedMin = 0; let backlogMin = 0;
    library.forEach(item => {
        if (item.type === 'movie') { const r = parseInt(item.runtime) || 120; if (item.status === 'Watched') watchedMin += r; else if (item.status !== 'Abandoned') backlogMin += r; }
        else if (item.type === 'series') { const defR = parseInt(item.runtime) || 24; (item.episodes || []).forEach(ep => { const r = parseInt(ep.runtime) || defR; if (ep.watched) watchedMin += r; else if (item.status !== 'Abandoned') backlogMin += r; }); }
    });
    document.getElementById('stat-hours').textContent = formatDurationProfile(watchedMin); document.getElementById('stat-backlog-hours').textContent = formatDurationProfile(backlogMin);
    const ratedItems = library.map(i => getCalculatedRating(i)).filter(r => r > 0); document.getElementById('stat-avg-rating').textContent = ratedItems.length > 0 ? (ratedItems.reduce((acc, r) => acc + r, 0) / ratedItems.length).toFixed(1) : '0.0';
    const sFinished = series.filter(s => s.status === 'Watched').length; document.getElementById('stat-series-grid').innerHTML = `<div class="text-lg font-black text-teal-400">${sFinished} / ${series.length}</div><div class="text-xs font-bold text-teal-400">${series.length > 0 ? Math.round((sFinished / series.length) * 100) : 0}%</div><div class="text-[9px] uppercase text-gray-400 mt-1 tracking-wider">Séries finies</div>`;
    let seTotal = 0, seWatched = 0; series.forEach(s => { seTotal += (s.episodes || []).length; seWatched += (s.episodes || []).filter(e => e.watched).length; }); document.getElementById('stat-series-eps-grid').innerHTML = `<div class="text-lg font-black text-teal-400">${seWatched} / ${seTotal}</div><div class="text-xs font-bold text-teal-400">${seTotal > 0 ? Math.round((seWatched / seTotal) * 100) : 0}%</div><div class="text-[9px] uppercase text-gray-400 mt-1 tracking-wider">Ép. Séries vus</div>`;
    const aFinished = animes.filter(a => a.status === 'Watched').length; document.getElementById('stat-anime-grid').innerHTML = `<div class="text-lg font-black text-purple-400">${aFinished} / ${animes.length}</div><div class="text-xs font-bold text-purple-400">${animes.length > 0 ? Math.round((aFinished / animes.length) * 100) : 0}%</div><div class="text-[9px] uppercase text-gray-400 mt-1 tracking-wider">Anime finis</div>`;
    let aeTotal = 0, aeWatched = 0; animes.forEach(a => { aeTotal += (a.episodes || []).length; aeWatched += (a.episodes || []).filter(e => e.watched).length; }); document.getElementById('stat-anime-eps-grid').innerHTML = `<div class="text-lg font-black text-purple-400">${aeWatched} / ${aeTotal}</div><div class="text-xs font-bold text-purple-400">${aeTotal > 0 ? Math.round((aeWatched / aeTotal) * 100) : 0}%</div><div class="text-[9px] uppercase text-gray-400 mt-1 tracking-wider">Ép. Anime vus</div>`;
    const mFinished = movies.filter(m => m.status === 'Watched').length; document.getElementById('stat-movies-finished').innerHTML = `<div class="text-lg font-black text-amber-400">${mFinished} / ${movies.length}</div><div class="text-xs font-bold text-amber-400">${movies.length > 0 ? Math.round((mFinished / movies.length) * 100) : 0}%</div><div class="text-[9px] uppercase text-gray-400 mt-1 tracking-wider">Films vus</div>`;
    const gc = {}; library.forEach(i => (i.genres || []).forEach(g => gc[g] = (gc[g] || 0) + 1)); const sortedGenres = Object.entries(gc).sort((a, b) => b[1] - a[1]); const maxG = sortedGenres.length > 0 ? sortedGenres[0][1] : 1; document.getElementById('stat-genre-bars').innerHTML = sortedGenres.slice(0, 5).map(([g, c]) => `<div onclick="applyGlobalFilter('genre', '${g}')" class="cursor-pointer hover:opacity-80 transition group"><div class="flex justify-between text-[10px] mb-1 font-bold"><span class="text-gray-300 group-hover:text-white">${g}</span><span class="text-teal-500">${c}</span></div><div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-teal-500" style="width:${Math.round(c / maxG * 100)}%"></div></div></div>`).join('');
    const nc = {}; library.forEach(i => { if (i.network && i.network !== 'Inconnu') nc[i.network] = (nc[i.network] || 0) + 1; }); const sortedNets = Object.entries(nc).sort((a, b) => b[1] - a[1]); const maxN = sortedNets.length > 0 ? sortedNets[0][1] : 1; document.getElementById('stat-network-bars').innerHTML = sortedNets.slice(0, 6).map(([n, c]) => `<div onclick="applyGlobalFilter('network', '${n}')" class="cursor-pointer hover:opacity-80 transition group"><div class="flex justify-between text-[10px] mb-1 font-bold"><span class="text-gray-300 group-hover:text-white">${n}</span><span class="text-blue-500">${c}</span></div><div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-blue-500" style="width:${Math.round(c / maxN * 100)}%"></div></div></div>`).join('');
    const rc = {}; library.forEach(i => { const r = getCalculatedRating(i); if (r > 0) { let rounded = Math.round(r * 2) / 2; let key = rounded < 5 ? "< 5" : rounded.toFixed(1).replace('.0', ''); rc[key] = (rc[key] || 0) + 1; } }); let ratingKeys = []; for (let i = 10; i >= 5; i -= 0.5) ratingKeys.push(i.toFixed(1).replace('.0', '')); ratingKeys.push("< 5"); const activeRatings = ratingKeys.filter(k => rc[k] > 0); const maxR = activeRatings.length > 0 ? Math.max(...activeRatings.map(k => rc[k])) : 1;
    document.getElementById('stat-rating-bars').innerHTML = activeRatings.map(k => `<div onclick="applyGlobalFilter('rating', '${k}')" class="cursor-pointer hover:opacity-80 transition group"><div class="flex justify-between text-[10px] mb-1 font-bold"><span class="text-gray-300 group-hover:text-white">${k}</span><span class="text-yellow-500">${rc[k]}</span></div><div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden"><div class="h-full bg-yellow-400" style="width:${Math.round(rc[k] / maxR * 100)}%"></div></div></div>`).join('');
    if (activeRatings.length === 0) { document.getElementById('stat-rating-bars').innerHTML = '<div class="text-[10px] text-gray-500 italic text-center py-2">Aucune note attribuée</div>'; }
}
