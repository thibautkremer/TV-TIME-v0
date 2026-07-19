'use strict';
// ============================================================
// ADMIN — MAJ de masse API (Metadata + Épisodes + Notes Hybrides)
// ============================================================

const _originalLog = console.log;
const _originalWarn = console.warn;
const _originalError = console.error;

function addLogToUI(args, type='log') {
    const consoleEl = document.getElementById('adminConsoleBox');
    if (!consoleEl) return;
    const msg = Array.from(args).map(a => {
        if (a instanceof Error) return `${a.name}: ${a.message}`; 
        if (typeof a === 'object' && a !== null) {
            try { return JSON.stringify(a, null, 2); } catch(e) { return '[Objet]'; }
        }
        return a;
    }).join(' ');

    const div = document.createElement('div');
    let colorClass = type === 'error' ? 'text-red-400 font-bold' : (type === 'warn' ? 'text-yellow-400' : 'text-gray-300');
    if (msg.includes('✅')) colorClass = 'text-emerald-400';
    else if (msg.includes('---')) colorClass = 'text-teal-400 font-bold';
    else if (msg.includes('➖')) colorClass = 'text-gray-500';

    div.className = `text-[10px] mb-1 pb-1 border-b border-gray-700/50 font-mono whitespace-pre-wrap break-words ${colorClass}`;
    div.textContent = `[${new Date().toLocaleTimeString('fr-FR', { hour12: false })}] ${msg}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

console.log = function(...args) { _originalLog.apply(console, args); addLogToUI(args, 'log'); };
console.warn = function(...args) { _originalWarn.apply(console, args); addLogToUI(args, 'warn'); };
console.error = function(...args) { _originalError.apply(console, args); addLogToUI(args, 'error'); };

function normalizePlatform(name) {
    if (!name) return name;
    const lower = name.toLowerCase();
    if (lower.includes('disney')) return 'Disney+';
    if (lower.includes('prime') || lower.includes('amazon')) return 'Prime Video';
    if (lower.includes('apple')) return 'Apple TV+';
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('hbo') || lower === 'max') return 'Max';
    if (lower.includes('paramount')) return 'Paramount+';
    if (lower.includes('crunchyroll') || lower.includes('wakanim')) return 'Crunchyroll';
    if (lower.includes('adn')) return 'ADN';
    return name;
}

async function syncSingleMediaData(item) {
    const tmdbType = item.type === 'series' ? 'tv' : 'movie';
    const url = `${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erreur TMDB ${res.status}`);
    const data = await res.json();
    
    let changes = [];
    
    let imdbId = null;
    try {
        const idsRes = await fetch(`${TMDB_BASE}/${tmdbType}/${item.apiId}/external_ids?api_key=${TMDB_API_KEY}`);
        const idsData = await idsRes.json();
        imdbId = idsData.imdb_id;
    } catch (e) { console.warn("ID IMDB introuvable."); }

    if (item.type === 'movie') {
        let bestRating = Math.round((data.vote_average || 0) * 10) / 10;
        if (imdbId) {
            const omdbRating = await getImdbRating(imdbId);
            if (omdbRating && omdbRating > bestRating) bestRating = omdbRating;
        }
        if (item.rating !== bestRating) {
            changes.push(`Note Globale (${item.rating} -> ${bestRating})`);
            item.rating = bestRating;
        }
    } else if (item.type === 'series') {
        const freshEpisodes = await fetchAllTmdbEpisodes(item.apiId);
        
        // SÉCURITÉ 1 : Ne pas écraser si l'API TMDB plante et renvoie vide
        if (freshEpisodes.length === 0 && item.episodes && item.episodes.length > 0) {
            console.warn(`⚠️ TMDB a renvoyé 0 épisode pour ${item.title}. Conservation des anciennes données.`);
        } else {
            const watchedMap = new Map();
            (item.episodes || []).forEach(ep => { if (ep.watched) watchedMap.set(`${ep.season}-${ep.number}`, true); });

            const wasGloballyWatched = (item.status === 'Watched');
            let hasAiredEpisodes = false;
            let allAiredAreWatched = true;

            for (let ep of freshEpisodes) {
                // SÉCURITÉ 2 : Si la série était 'Vu', on s'assure que les épisodes sortis sont cochés
                if (watchedMap.has(`${ep.season}-${ep.number}`)) {
                    ep.watched = true;
                } else if (wasGloballyWatched && ep.airdate && ep.airdate <= todayString) {
                    ep.watched = true;
                }
                
                // Analyse stricte pour le statut de la série
                if (ep.airdate && ep.airdate <= todayString) {
                    hasAiredEpisodes = true;
                    if (!ep.watched) allAiredAreWatched = false;
                }

                if (imdbId) {
                    const omdbEpRating = await getImdbEpisodeRating(imdbId, ep.season, ep.number);
                    if (omdbEpRating && omdbEpRating > ep.rating) ep.rating = omdbEpRating;
                }
            }
            
            const newAvg = computeAvgEpisodeRating(freshEpisodes);
            if (item.rating !== newAvg) { changes.push(`Note Globale (${item.rating} -> ${newAvg})`); item.rating = newAvg; }
            
            item.episodes = freshEpisodes;

            // SÉCURITÉ 3 : Calcul infaillible du statut global
            if (item.status !== 'Abandoned') {
                let newStatus = 'In Progress';
                if (hasAiredEpisodes && allAiredAreWatched) newStatus = 'Watched';
                
                if (item.status !== newStatus) {
                    changes.push(`Statut (${item.status} -> ${newStatus})`);
                    item.status = newStatus;
                }
            }
        }
    }
    
    if (data.overview && item.summary !== data.overview) { changes.push("Résumé"); item.summary = data.overview; }
    const newImage = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
    if (data.poster_path && item.image !== newImage) { changes.push("Image"); item.image = newImage; }
    
    let newNetwork = item.network;
    if (data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) newNetwork = normalizePlatform(data['watch/providers'].results.FR.flatrate[0].provider_name);
    if (item.network !== newNetwork) { changes.push(`Plateforme (${newNetwork})`); item.network = newNetwork; }
    
    return changes;
}

async function singleUpdateMedia(mediaId) {
    const item = libraryIndex.get(mediaId);
    if (!item) return;
    const btn = document.getElementById('modalSingleUpdateBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳...'; }
    
    console.log(`--- SINGLE UPDATE : ${item.title_fr || item.title} ---`);
    try {
        const changes = await syncSingleMediaData(item);
        if (changes.length > 0) {
            item.last_modified = Date.now();
            await saveLocalDB(item);
            console.log(`✅ ${item.title_fr || item.title} : ${changes.join(' | ')}`);
        } else {
            console.log(`➖ Inchangé : ${item.title_fr || item.title}`);
        }
        
        populateModalBase(item); 
        if (item.type === 'series' && item.episodes) {
            currentSeriesAvgRating = computeAvgEpisodeRating(item.episodes); 
            buildSeasonTabs(item.episodes, true); 
        }
        if (!document.getElementById('tab-library').classList.contains('hidden')) renderLibrary();
        
        if (btn) { btn.innerHTML = '✅ OK'; setTimeout(() => { btn.innerHTML = '🔄 MAJ'; btn.disabled = false; }, 2000); }
    } catch (e) {
        console.error(e);
        if (btn) { btn.innerHTML = '❌ Err'; setTimeout(() => { btn.innerHTML = '🔄 MAJ'; btn.disabled = false; }, 2000); }
    }
}

async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const itemsToProcess = library.filter(i => i.type === type);
    if (itemsToProcess.length === 0) { alert("Aucun média."); return; }

    console.log(`--- DÉBUT MAJ COMPLETE (${type.toUpperCase()}) ---`);
    for (let i = 0; i < itemsToProcess.length; i++) {
        try {
            const changes = await syncSingleMediaData(itemsToProcess[i]);
            if (changes.length > 0) {
                itemsToProcess[i].last_modified = Date.now();
                await saveLocalDB(itemsToProcess[i]);
                console.log(`✅ ${itemsToProcess[i].title_fr || itemsToProcess[i].title} : ${changes.join(' | ')}`);
            }
        } catch (e) { console.error(e); }
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`--- FIN MAJ COMPLETE ---`);
    if (!silent) location.reload();
}

async function importProgressionOnly(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            let updatedCount = 0;
            for (let localItem of library) {
                const backupItem = importedData.find(i => i.id === localItem.id || i.apiId === localItem.apiId);
                if (backupItem) {
                    let changed = false;
                    if (localItem.status !== backupItem.status) { localItem.status = backupItem.status; changed = true; }
                    if (localItem.type === 'series' && localItem.episodes && backupItem.episodes) {
                        const bMap = new Map(backupItem.episodes.filter(ep => ep.watched).map(ep => [`${ep.season}-${ep.number}`, true]));
                        localItem.episodes.forEach(le => {
                            if (le.watched !== bMap.has(`${le.season}-${le.number}`)) { le.watched = bMap.has(`${le.season}-${le.number}`); changed = true; }
                        });
                    }
                    if (changed) { await saveLocalDB(localItem); updatedCount++; }
                }
            }
            alert(`Mini-Import terminé : ${updatedCount} médias restaurés.`);
        } catch (e) { console.error(e); alert("Erreur import JSON."); }
    };
    reader.readAsText(file);
}
