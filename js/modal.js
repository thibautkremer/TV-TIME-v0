'use strict';
// ============================================================
// MODAL — fiche détail média (preview & bibliothèque)
// ============================================================

function populateModalBase(media) {
    currentModalMediaId = media.id; 
    window.currentModalMediaObj = media; 
    window.currentModalApiId = media.apiId;

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
    
    document.getElementById('modalSingleUpdateBtn').classList.add('hidden');
    
    document.getElementById('modalScrollable').scrollTop = 0;

    const btnMovix = document.getElementById('btnMovixRedirect');
    btnMovix.onclick = (e) => {
        e.preventDefault();
        const path = media.type === 'series' ? 'tv' : 'movie';
        window.open(`https://movix.date/${path}/${window.currentModalApiId}`, '_blank');
    };

    if (media.type === 'movie') {
        document.getElementById('modalMovieActions').classList.remove('hidden');
        const cleanTitle = (media.title_fr || media.title).split('(')[0].trim();
        document.getElementById('modalMovieTrailerBtn').onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' bande annonce VF')}`, '_blank');
        document.getElementById('modalMovieSummaryBtn').onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' résumé complet FR')}`, '_blank');
    }
}

async function openPreviewModal(media) {
    modalMode = 'preview'; activeModalMediaIndex = null;
    populateModalBase(media);
    const fBtn = document.getElementById('modalActionFollowBtn'); const wBtn = document.getElementById('modalActionAllWatchedBtn');
    fBtn.textContent = '+ À regarder'; fBtn.className = "w-full py-3 bg-teal-600 text-white font-bold rounded-xl text-xs"; fBtn.onclick = async () => { fBtn.textContent = 'Ajout...'; await quickAdd(media.id, false); closeModal(); };
    wBtn.textContent = '✓ Déjà vu'; wBtn.className = "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs"; wBtn.onclick = async () => { wBtn.textContent = 'Ajout...'; await quickAdd(media.id, true); closeModal(); };

    if (media.type === 'series') {
        document.getElementById('modalSeriesContent').classList.remove('hidden');
        const apiEps = await fetchAllTmdbEpisodes(media.apiId);
        previewEpisodes = apiEps;
        currentSeriesAvgRating = computeAvgEpisodeRating(previewEpisodes); buildSeasonTabs(previewEpisodes, false); renderGlobalGraph(previewEpisodes);
    }
    document.getElementById('mediaModal').classList.remove('hidden');
}

function openLibraryModal(id) {
    modalMode = 'library'; activeModalMediaIndex = library.findIndex(i => i.id === id); const item = library[activeModalMediaIndex]; if (!item) return;
    populateModalBase(item);
    
    const singleUpdateBtn = document.getElementById('modalSingleUpdateBtn');
    singleUpdateBtn.classList.remove('hidden');
    singleUpdateBtn.onclick = () => singleUpdateMedia(item.id);
    
    const fBtn = document.getElementById('modalActionFollowBtn'); const wBtn = document.getElementById('modalActionAllWatchedBtn');
    fBtn.textContent = '✕ Retirer'; fBtn.className = "w-full py-3 bg-gray-900 text-red-400 border border-red-900/50 font-bold rounded-xl text-xs"; fBtn.onclick = async () => { await handleRemove(item.id); closeModal(); };

    if (item.status === 'Watched') { 
        wBtn.textContent = '↺ Marquer Non Vu'; 
        wBtn.className = "w-full py-3 bg-gray-900 text-amber-400 border border-amber-900/50 font-bold rounded-xl text-xs"; 
        wBtn.onclick = () => { 
            if (item.episodes) item.episodes.forEach(e => e.watched = false); 
            item.status = 'In Progress'; 
            item.last_modified = Date.now(); 
            saveLocalDB(item); closeModal(); renderLibrary(); 
        }; 
    } else { 
        wBtn.textContent = '✓ Marquer Vu'; 
        wBtn.className = "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow transition"; 
        wBtn.onclick = () => { 
            if (item.episodes) {
                // SÉCURITÉ : Coche uniquement les épisodes sortis
                item.episodes.forEach(e => {
                    if (e.airdate && e.airdate <= todayString) e.watched = true;
                });
            }
            item.status = 'Watched'; 
            item.last_modified = Date.now(); 
            saveLocalDB(item); closeModal(); renderLibrary(); 
        }; 
    }

    if (item.type === 'series' && item.episodes) {
        document.getElementById('modalSeriesContent').classList.remove('hidden');
        const prog = getProgress(item); document.getElementById('modalProgressContainer').classList.remove('hidden'); document.getElementById('modalProgressText').textContent = `${prog}%`; document.getElementById('modalProgressBar').style.width = `${prog}%`;
        currentSeriesAvgRating = computeAvgEpisodeRating(item.episodes); buildSeasonTabs(item.episodes, true); renderGlobalGraph(item.episodes);
    }
    document.getElementById('mediaModal').classList.remove('hidden');
}

function closeModal() { window.suggestionsObserver?.disconnect(); document.getElementById('mediaModal').classList.add('hidden'); const posterEl = document.getElementById('modalPoster'); if (posterEl.classList.contains('fixed')) togglePosterSize(posterEl); }
function renderGlobalGraph(eps) { const container = document.getElementById('modalGlobalGraph'); const frag = document.createDocumentFragment(); eps.forEach(ep => { const val = (typeof ep.rating === 'object' && ep.rating !== null) ? (ep.rating.average || 0) : (parseFloat(ep.rating) || 0); const r = val > 0 ? val : currentSeriesAvgRating; const h = Math.max(10, (r / 10) * 100); const colorClass = seasonColors[(ep.season - 1) % seasonColors.length] || 'bg-teal-500'; const bar = document.createElement('div'); bar.className = `flex-1 min-w-[4px] ${colorClass} hover:opacity-80 rounded-t cursor-pointer relative z-10`; bar.style.height = `${h}%`; bar.title = `S${ep.season}E${ep.number}: ${r}`; frag.appendChild(bar); }); container.innerHTML = ''; container.appendChild(frag); }
function renderSeasonGraph(eps) { const container = document.getElementById('modalSeasonGraph'); container.innerHTML = ''; eps.forEach(ep => { const val = (typeof ep.rating === 'object' && ep.rating !== null) ? (ep.rating.average || 0) : (ep.rating || 0); const r = val > 0 ? val : currentSeriesAvgRating; const h = Math.max(10, (r / 10) * 100); const colorClass = seasonColors[(ep.season - 1) % seasonColors.length] || 'bg-cyan-600'; container.innerHTML += `<div class="flex-1 min-w-[12px] ${colorClass} transition rounded-t cursor-pointer flex flex-col justify-end items-center relative z-10" style="height: ${h}%" title="E${ep.number}: ${r}"><span class="text-[8px] text-white font-bold mb-0.5 opacity-80">${r > 0 ? r : ''}</span></div>`; }); }

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

function renderEpisodes(eps, isLib) {
    const list = document.getElementById('modalEpisodesList'); 
    renderSeasonGraph(eps);
    
    const item = library[activeModalMediaIndex]; 
    const targetId = (item && item.apiId) ? item.apiId : window.currentModalApiId; 

    list.innerHTML = eps.map(ep => {
        const isFuture = !ep.airdate || ep.airdate > todayString; 
        const val = (typeof ep.rating === 'object' && ep.rating !== null) ? (ep.rating.average || 0) : (parseFloat(ep.rating) || 0); 
        const rateStr = val > 0 ? `<span class="text-[9px] text-yellow-400 font-bold ml-2">★ ${val.toFixed(1)}</span>` : '';
        const btnClass = isFuture ? 'bg-gray-800/50 text-gray-600' : (ep.watched ? 'bg-emerald-900 text-emerald-400' : 'bg-gray-700 hover:bg-gray-600');
        
        const streamUrl = !isFuture ? `https://movix.date/watch/tv/${targetId}/s/${ep.season}/e/${ep.number}` : '#';
        const streamBtn = !isFuture ? `<a href="${streamUrl}" target="_blank" class="px-2 py-1 rounded text-[10px] shrink-0 font-bold bg-indigo-700 hover:bg-indigo-600 text-white transition mr-1">▶</a>` : '';

        const btnAction = isLib ? `<button onclick="event.stopPropagation(); ${!isFuture ? `toggleEpCascade(${ep.id}, '${ep.season}')` : ''}" class="px-2 py-1 rounded text-[10px] shrink-0 font-bold transition ${btnClass}" ${isFuture ? 'disabled' : ''}>${ep.watched ? '✓ Vu' : 'Vu'}</button>` : '';
        
        return `<div class="rounded-xl bg-gray-900/60 border border-gray-700/50 text-xs overflow-hidden cursor-pointer" onclick="toggleEpisodeDescription(this)">
            <div class="p-2 flex justify-between items-center">
                <span class="truncate text-gray-300 flex-1">E${ep.number} – <b class="text-white">${ep.name}</b> <span class="text-gray-500 ml-1">${ep.airdate || 'TBA'}</span> ${rateStr}</span>
                <div class="flex items-center">${streamBtn}${btnAction}</div>
            </div>
            <div class="episode-desc p-2 pt-0 text-gray-400 hidden border-t border-gray-700/50"><p class="mt-2 leading-relaxed">${ep.summary || "Pas de description disponible."}</p></div>
        </div>`;
    }).join('');
}

function toggleEpCascade(epId, seasonStr) {
    const item = library[activeModalMediaIndex]; const epIndex = item.episodes.findIndex(e => e.id === epId); if (epIndex === -1) return;
    const targetState = !item.episodes[epIndex].watched; 
    
    if (targetState) { 
        for (let i = 0; i <= epIndex; i++) item.episodes[i].watched = true; 
    } else { 
        for (let i = epIndex; i < item.episodes.length; i++) item.episodes[i].watched = false; 
    }
    
    // SÉCURITÉ : Ne considère que les épisodes sortis pour évaluer le statut global "Watched"
    const airedEps = item.episodes.filter(e => e.airdate && e.airdate <= todayString);
    item.status = (airedEps.length > 0 && airedEps.every(e => e.watched)) ? 'Watched' : 'In Progress';
    
    item.last_modified = Date.now(); saveLocalDB(item);
    const prog = getProgress(item); document.getElementById('modalProgressText').textContent = `${prog}%`; document.getElementById('modalProgressBar').style.width = `${prog}%`;
    renderEpisodes(item.episodes.filter(e => e.season === parseInt(seasonStr)), true); if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
}

// ✅ À AJOUTER À LA FIN DE JS/MODAL.JS
function toggleEpisodeDescription(element) {
    const desc = element.querySelector('.episode-desc');
    if (desc) desc.classList.toggle('hidden');
}
