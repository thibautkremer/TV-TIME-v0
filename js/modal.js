'use strict';
// ============================================================
// MODAL — fiche détail média (preview & bibliothèque)
// ============================================================

async function populateModalBase(media) {
    currentModalMediaId = media.id; 
    document.getElementById('modalTitle').textContent = media.title_fr || media.title;
    
    const posterEl = document.getElementById('modalPoster'); 
    posterEl.src = getOptimizedImageUrl(media.image, 600); 
    posterEl.onerror = () => { posterEl.src = media.image; };
    
    if (posterEl.classList.contains('fixed')) togglePosterSize(posterEl);
    
    document.getElementById('modalSummary').textContent = media.summary || 'Aucun résumé.'; 
    document.getElementById('modalPremiereDate').textContent = media.premiered || 'N/A'; 
    document.getElementById('modalRuntime').textContent = media.runtime > 0 ? `${media.runtime} min` : '-- min'; 
    document.getElementById('modalNetwork').textContent = media.network || '';
    
    const rate = getCalculatedRating(media); 
    document.getElementById('modalGlobalRatingText').textContent = rate > 0 ? rate.toFixed(1) : 'N/A'; 
    document.getElementById('modalGlobalRatingBar').style.width = `${(rate / 10) * 100}%`;
    
    const badge = document.getElementById('modalProductionBadge'); 
    const s = (media.status_production || '').toLowerCase();
    if (s.includes('running')) { badge.textContent = 'En cours'; badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-400'; } 
    else if (s.includes('ended')) { badge.textContent = 'Terminée'; badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-300'; } 
    else if (s.includes('cancel')) { badge.textContent = 'Annulée'; badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-900 text-red-400'; } 
    else { badge.textContent = media.status_production || ''; badge.className = 'text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-300'; }

    document.getElementById('modalProgressContainer').classList.add('hidden'); 
    document.getElementById('modalSeriesContent').classList.add('hidden'); 
    document.getElementById('modalEpisodesBlock').classList.add('hidden'); 
    document.getElementById('modalSuggestionsBlock').classList.add('hidden'); 
    document.getElementById('modalMovieActions').classList.add('hidden');
    document.getElementById('modalScrollable').scrollTop = 0;

    // --- CORRECTION : Résolution dynamique du bouton Movix ---
    const btnMovix = document.getElementById('btnMovixRedirect');
    const cleanTitle = (media.title_fr || media.title).split('(')[0].trim();
    
    // URL par défaut si pas d'ID valide
    btnMovix.href = media.movixUrl ? media.movixUrl : `https://movix.cash/search?q=${encodeURIComponent(cleanTitle)}`;
    
    btnMovix.onclick = async (e) => {
        if (media.movixUrl) return; // Utilise le lien manuel si configuré
        
        e.preventDefault();
        const originalText = btnMovix.textContent;
        btnMovix.textContent = "Recherche ID...";
        
        try {
            const searchRes = await fetch(`${TMDB_BASE}/search/${media.type === 'series' ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(cleanTitle)}`);
            const searchData = await searchRes.json();
            
            if (searchData.results && searchData.results.length > 0) {
                const realTmdbId = searchData.results[0].id;
                // Redirection vers le lecteur Movix avec le bon ID TMDB trouvé
                window.open(`https://movix.date/watch/${media.type === 'series' ? 'tv' : 'movie'}/${realTmdbId}`, '_blank');
            } else {
                window.open(btnMovix.href, '_blank');
            }
        } catch (err) {
            window.open(btnMovix.href, '_blank');
        } finally {
            btnMovix.textContent = originalText;
        }
    };
    // --------------------------------------------------------

    if (media.type === 'movie') {
        document.getElementById('modalMovieActions').classList.remove('hidden');
        document.getElementById('modalMovieTrailerBtn').onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' bande annonce VF')}`, '_blank');
        document.getElementById('modalMovieSummaryBtn').onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' résumé complet FR')}`, '_blank');
    }
}

async function openPreviewModal(media) {
    modalMode = 'preview'; activeModalMediaIndex = null;
    await resolveSeriesFromImdb(media); await resolveMovieFromTmdb(media);
    populateModalBase(media);
    const fBtn = document.getElementById('modalActionFollowBtn'); const wBtn = document.getElementById('modalActionAllWatchedBtn');
    fBtn.textContent = '+ À regarder'; fBtn.className = "w-full py-3 bg-teal-600 text-white font-bold rounded-xl text-xs"; fBtn.onclick = async () => { fBtn.textContent = 'Ajout...'; await quickAdd(media.id, false); closeModal(); };
    wBtn.textContent = '✓ Déjà vu'; wBtn.className = "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs"; wBtn.onclick = async () => { wBtn.textContent = 'Ajout...'; await quickAdd(media.id, true); closeModal(); };

    if (media.type === 'series') {
        document.getElementById('modalSeriesContent').classList.remove('hidden');
        try {
            const res = await fetch(`${TVMAZE_API}/shows/${media.apiId}/episodes`); const apiEps = await res.json();
            previewEpisodes = apiEps.map(e => ({ id: e.id, season: e.season, number: e.number, name: e.name, airdate: e.airdate, rating: e.rating?.average || 0, watched: false }));
            currentSeriesAvgRating = computeAvgEpisodeRating(previewEpisodes); buildSeasonTabs(previewEpisodes, false); renderGlobalGraph(previewEpisodes);
        } catch (e) {}
    }
    document.getElementById('mediaModal').classList.remove('hidden');
}

function openLibraryModal(id) {
    modalMode = 'library'; activeModalMediaIndex = library.findIndex(i => i.id === id); const item = library[activeModalMediaIndex]; if (!item) return;
    populateModalBase(item);
    const fBtn = document.getElementById('modalActionFollowBtn'); const wBtn = document.getElementById('modalActionAllWatchedBtn');
    fBtn.textContent = '✕ Retirer'; fBtn.className = "w-full py-3 bg-gray-900 text-red-400 border border-red-900/50 font-bold rounded-xl text-xs"; fBtn.onclick = async () => { await handleRemove(item.id); closeModal(); };

    if (item.status === 'Watched') { wBtn.textContent = '↺ Marquer Non Vu'; wBtn.className = "w-full py-3 bg-gray-900 text-amber-400 border border-amber-900/50 font-bold rounded-xl text-xs"; wBtn.onclick = () => { if (item.episodes) item.episodes.forEach(e => e.watched = false); item.status = 'In Progress'; item.last_modified = Date.now(); saveLocalDB(item); closeModal(); renderLibrary(); }; }
    else { wBtn.textContent = '✓ Marquer Vu'; wBtn.className = "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow transition"; wBtn.onclick = () => { if (item.episodes) item.episodes.forEach(e => e.watched = true); item.status = 'Watched'; item.last_modified = Date.now(); saveLocalDB(item); closeModal(); renderLibrary(); }; }

    if (item.type === 'series' && item.episodes) {
        document.getElementById('modalSeriesContent').classList.remove('hidden');
        const prog = getProgress(item); document.getElementById('modalProgressContainer').classList.remove('hidden'); document.getElementById('modalProgressText').textContent = `${prog}%`; document.getElementById('modalProgressBar').style.width = `${prog}%`;
        currentSeriesAvgRating = computeAvgEpisodeRating(item.episodes); buildSeasonTabs(item.episodes, true); renderGlobalGraph(item.episodes);
    }
    document.getElementById('mediaModal').classList.remove('hidden');
}

function closeModal() { suggestionsObserver.disconnect(); document.getElementById('mediaModal').classList.add('hidden'); const posterEl = document.getElementById('modalPoster'); if (posterEl.classList.contains('fixed')) togglePosterSize(posterEl); }

function renderGlobalGraph(eps) {
    const container = document.getElementById('modalGlobalGraph'); const frag = document.createDocumentFragment();
    eps.forEach(ep => { const val = (typeof ep.rating === 'object' && ep.rating !== null) ? (ep.rating.average || 0) : (parseFloat(ep.rating) || 0); const r = val > 0 ? val : currentSeriesAvgRating; const h = Math.max(10, (r / 10) * 100); const colorClass = seasonColors[(ep.season - 1) % seasonColors.length] || 'bg-teal-500'; const bar = document.createElement('div'); bar.className = `flex-1 min-w-[4px] ${colorClass} hover:opacity-80 rounded-t cursor-pointer relative z-10`; bar.style.height = `${h}%`; bar.title = `S${ep.season}E${ep.number}: ${r}`; frag.appendChild(bar); });
    container.innerHTML = ''; container.appendChild(frag);
}

function renderSeasonGraph(eps) {
    const container = document.getElementById('modalSeasonGraph'); container.innerHTML = '';
    eps.forEach(ep => { const val = (typeof ep.rating === 'object' && ep.rating !== null) ? (ep.rating.average || 0) : (ep.rating || 0); const r = val > 0 ? val : currentSeriesAvgRating; const h = Math.max(10, (r / 10) * 100); const colorClass = seasonColors[(ep.season - 1) % seasonColors.length] || 'bg-cyan-600'; container.innerHTML += `<div class="flex-1 min-w-[12px] ${colorClass} transition rounded-t cursor-pointer flex flex-col justify-end items-center relative z-10" style="height: ${h}%" title="E${ep.number}: ${r}"><span class="text-[8px] text-white font-bold mb-0.5 opacity-80">${r > 0 ? r : ''}</span></div>`; });
}

function buildSeasonTabs(episodes, isLib) {
    const seasons = [...new Set(episodes.map(e => e.season))]; const tabs = document.getElementById('modalSeasonTabs'); tabs.innerHTML = ''; document.getElementById('modalEpisodesBlock').classList.remove('hidden');
    let targetSeason = seasons[0]; if (isLib) { const firstUnwatched = episodes.find(e => !e.watched && e.airdate && e.airdate <= todayString) || episodes.find(e => !e.watched); if (firstUnwatched) targetSeason = firstUnwatched.season; else targetSeason = seasons[seasons.length - 1]; }
    const summaryBtn = document.getElementById('modalSeasonSummaryBtn'); const trailerBtn = document.getElementById('modalTrailerBtn');
    if (seasons.length > 0) { summaryBtn.classList.remove('hidden'); trailerBtn.classList.remove('hidden'); } else { summaryBtn.classList.add('hidden'); trailerBtn.classList.add('hidden'); }
    function updateActionBtns(season) { const title = document.getElementById('modalTitle').textContent.split('(')[0].trim(); summaryBtn.onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' saison ' + season + ' résumé complet FR')}`, '_blank'); trailerBtn.onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' saison ' + season + ' bande annonce VF')}`, '_blank'); }

    seasons.forEach((s) => {
        const btn = document.createElement('button'); const colorClass = seasonColors[(s - 1) % seasonColors.length] || 'bg-teal-600'; const isActive = s === targetSeason;
        btn.className = `px-3 py-1 text-xs font-bold rounded-lg shrink-0 ${isActive ? `${colorClass} text-white` : 'bg-gray-700 text-gray-300'}`; btn.textContent = `S${s}`;
        btn.onclick = (e) => { Array.from(tabs.children).forEach(b => b.className = 'px-3 py-1 text-xs font-bold rounded-lg shrink-0 bg-gray-700 text-gray-300'); e.target.className = `px-3 py-1 text-xs font-bold rounded-lg shrink-0 ${colorClass} text-white`; renderEpisodes(episodes.filter(ep => ep.season === s), isLib); updateActionBtns(s); }; tabs.appendChild(btn);
    });
    if (seasons.length > 0) { renderEpisodes(episodes.filter(ep => ep.season === targetSeason), isLib); updateActionBtns(targetSeason); }
}

async function renderEpisodes(eps, isLib) {
    const list = document.getElementById('modalEpisodesList'); 
    renderSeasonGraph(eps);
    const item = library[activeModalMediaIndex];
    const cleanTitle = (item.title_fr || item.title).split('(')[0].trim();

    // On cherche l'ID TMDB à la volée via une recherche par titre
    // Cela garantit d'avoir toujours le bon ID pour Movix, peu importe ce qu'il y a dans ta base
    let targetId = item.apiId; 
    try {
        const searchRes = await fetch(`${TMDB_BASE}/search/tv?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(cleanTitle)}`);
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
            targetId = searchData.results[0].id; // On récupère l'ID TMDB officiel automatiquement
        }
    } catch (e) {
        console.error("Erreur résolution auto ID :", e);
    }

    list.innerHTML = eps.map(ep => {
        const isFuture = !ep.airdate || ep.airdate > todayString;
        
        // Utilisation du targetId résolu automatiquement
        const streamUrl = !isFuture ? `https://movix.date/watch/tv/${targetId}/s/${ep.season}/e/${ep.number}` : '#';
        const streamBtn = !isFuture ? `<a href="${streamUrl}" target="_blank" class="px-2 py-1 rounded text-[10px] shrink-0 font-bold bg-indigo-700 hover:bg-indigo-600 text-white transition mr-1">▶</a>` : '';

        // ... (reste du code inchangé) ...
        const btnClass = isFuture ? 'bg-gray-800/50 text-gray-600' : (ep.watched ? 'bg-emerald-900 text-emerald-400' : 'bg-gray-700 hover:bg-gray-600');
        const btnAction = isLib ? `<button onclick="event.stopPropagation(); ${!isFuture ? `toggleEpCascade(${ep.id}, '${ep.season}')` : ''}" class="px-2 py-1 rounded text-[10px] shrink-0 font-bold transition ${btnClass}" ${isFuture ? 'disabled' : ''}>${ep.watched ? '✓ Vu' : 'Vu'}</button>` : '';
        
        return `<div class="rounded-xl bg-gray-900/60 border border-gray-700/50 text-xs overflow-hidden cursor-pointer" onclick="toggleEpisodeDescription(this)">
            <div class="p-2 flex justify-between items-center">
                <span class="truncate text-gray-300 flex-1">E${ep.number} – <b class="text-white">${ep.name}</b> <span class="text-gray-500 ml-1">${ep.airdate || 'TBA'}</span></span>
                <div class="flex items-center">
                    ${streamBtn}
                    ${btnAction}
                </div>
            </div>
            <div class="episode-desc p-2 pt-0 text-gray-400 hidden border-t border-gray-700/50">
                <p class="mt-2 leading-relaxed">${ep.summary || "Pas de description disponible."}</p>
            </div>
        </div>`;
    }).join('');
}

function toggleEpCascade(epId, seasonStr) {
    const item = library[activeModalMediaIndex]; const epIndex = item.episodes.findIndex(e => e.id === epId); if (epIndex === -1) return;
    const targetState = !item.episodes[epIndex].watched; if (targetState) { for (let i = 0; i <= epIndex; i++) item.episodes[i].watched = true; } else { for (let i = epIndex; i < item.episodes.length; i++) item.episodes[i].watched = false; }
    item.status = item.episodes.every(e => e.watched || (!e.airdate || e.airdate > todayString)) ? 'Watched' : 'In Progress'; item.last_modified = Date.now(); saveLocalDB(item);
    const prog = getProgress(item); document.getElementById('modalProgressText').textContent = `${prog}%`; document.getElementById('modalProgressBar').style.width = `${prog}%`;
    renderEpisodes(item.episodes.filter(e => e.season === parseInt(seasonStr)), true); if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
}
