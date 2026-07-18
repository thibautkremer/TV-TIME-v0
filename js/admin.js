'use strict';
// ============================================================
// ADMIN — MAJ de masse API (Metadata + Épisodes + Notes)
// ============================================================

// Surcharge de la console pour afficher les logs dans l'UI Admin
const _originalLog = console.log;
const _originalWarn = console.warn;
const _originalError = console.error;

function addLogToUI(args, type='log') {
    const consoleEl = document.getElementById('adminConsoleBox');
    if (!consoleEl) return;
    
    const msg = Array.from(args).map(a => {
        if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); } catch(e) { return '[Objet]'; }
        }
        return a;
    }).join(' ');

    const div = document.createElement('div');
    let colorClass = 'text-gray-300';
    if (type === 'error') colorClass = 'text-red-400 font-bold';
    else if (type === 'warn') colorClass = 'text-yellow-400';
    else if (msg.includes('✅')) colorClass = 'text-emerald-400';
    else if (msg.includes('➖')) colorClass = 'text-gray-500';
    else if (msg.includes('---')) colorClass = 'text-teal-400 font-bold';

    div.className = `text-[10px] mb-1 pb-1 border-b border-gray-700/50 font-mono whitespace-pre-wrap break-words ${colorClass}`;
    
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
    div.textContent = `[${time}] ${msg}`;
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
    if (lower.includes('adn') || lower.includes('animation digital network')) return 'ADN';
    if (lower.includes('hulu')) return 'Hulu';
    if (lower.includes('peacock')) return 'Peacock';
    return name;
}

// Fonction unifiée de synchro (utilisée par Single et Mass Update)
async function syncSingleMediaData(item) {
    const tmdbType = item.type === 'series' ? 'tv' : 'movie';
    const url = `${TMDB_BASE}/${tmdbType}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erreur TMDB ${res.status}`);
    const data = await res.json();
    
    let changes = [];
    
    // 1. Logique de note selon le type de média
    if (item.type === 'movie') {
        // Comparaison TMDB vs OMDb (Prendre la meilleure) pour les Films
        let bestRating = Math.round((data.vote_average || 0) * 10) / 10;
        try {
            const idsRes = await fetch(`${TMDB_BASE}/${tmdbType}/${item.apiId}/external_ids?api_key=${TMDB_API_KEY}`);
            const externalIds = await idsRes.json();
            if (externalIds.imdb_id) {
                const omdbRating = await getImdbRating(externalIds.imdb_id);
                if (omdbRating && omdbRating > bestRating) {
                    bestRating = omdbRating;
                }
            }
        } catch (e) {
            console.warn("Note OMDb indisponible.");
        }

        if (item.rating !== bestRating) {
            changes.push(`Note Globale (${item.rating} -> ${bestRating})`);
            item.rating = bestRating;
        }
    } else if (item.type === 'series') {
        // Traitement des épisodes pour Séries/Animés
        const freshEpisodes = await fetchAllTmdbEpisodes(item.apiId);
        if (freshEpisodes.length > 0) {
            
            // --- FUSION DES ÉPISODES VUS ---
            const watchedMap = new Map();
            (item.episodes || []).forEach(ep => {
                if (ep.watched) watchedMap.set(`${ep.season}-${ep.number}`, true);
            });

            freshEpisodes.forEach(ep => {
                // Restauration du statut "Vu" si existant localement
                if (watchedMap.has(`${ep.season}-${ep.number}`)) {
                    ep.watched = true;
                }
                
                const oldEp = (item.episodes || []).find(e => e.season === ep.season && e.number === ep.number);
                if (oldEp && oldEp.rating !== ep.rating) {
                    if (!changes.includes("Notes Ep.")) changes.push("Notes Ep.");
                }
            });
            
            // Recalcul strict de la moyenne basée sur les épisodes frais
            const newAvg = computeAvgEpisodeRating(freshEpisodes);
            if (item.rating !== newAvg) {
                changes.push(`Note Globale (${item.rating} -> ${newAvg})`);
                item.rating = newAvg;
            }

            // Mise à jour du statut
            const allAiredWatched = freshEpisodes.every(e => e.watched || (!e.airdate || e.airdate > todayString));
            const correctStatus = allAiredWatched ? 'Watched' : 'In Progress';
            if (item.status !== correctStatus && item.status !== 'Abandoned') {
                changes.push(`Statut (${correctStatus})`);
                item.status = correctStatus;
            }
            item.episodes = freshEpisodes;
        }
    }
    
    // 2. Mise à jour Métadonnées (Résumé, Image, Plateforme)
    if (data.overview && item.summary !== data.overview) { 
        changes.push("Résumé"); 
        item.summary = data.overview; 
    }
    
    const newImage = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
    if (data.poster_path && item.image !== newImage) { 
        changes.push("Image"); 
        item.image = newImage; 
    }

    let newNetwork = item.network;
    if (data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) {
        newNetwork = data['watch/providers'].results.FR.flatrate[0].provider_name;
    } else if (item.type === 'series' && data.networks && data.networks.length > 0) {
        newNetwork = data.networks[0].name;
    }

    if (newNetwork) {
        newNetwork = normalizePlatform(newNetwork);
        if (item.network !== newNetwork) {
            changes.push(`Plateforme (${newNetwork})`);
            item.network = newNetwork;
        }
    }
    
    if (item.type === 'movie' && data.release_date && item.releaseDate !== data.release_date) {
        changes.push(`Date`);
        item.releaseDate = data.release_date;
    }
    
    return changes;
}

// Single Update (déclenché par la modale)
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
        console.error(`❌ Erreur Single Update : ${e.message}`);
        if (btn) { btn.innerHTML = '❌ Err'; setTimeout(() => { btn.innerHTML = '🔄 MAJ'; btn.disabled = false; }, 2000); }
    }
}

// Mass Update
async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const originalContent = btn ? btn.innerHTML : '';
    const itemsToProcess = library.filter(i => i.type === type);
    const total = itemsToProcess.length;

    if (total === 0) { alert("Aucun média."); return; }
    if (!silent && btn) { document.getElementById('btn-mass-update-series').disabled = true; document.getElementById('btn-mass-update-movie').disabled = true; }

    let updatedCount = 0, errorCount = 0, noChangeCount = 0;
    console.log(`--- DÉBUT DE LA MAJ COMPLETE (${type.toUpperCase()}) : ${total} ---`);

    for (let i = 0; i < total; i++) {
        let item = itemsToProcess[i];
        if (!silent && btn) btn.innerHTML = `⏳ [${i + 1}/${total}]`;
        try {
            const changes = await syncSingleMediaData(item);
            if (changes.length > 0) {
                item.last_modified = Date.now();
                await saveLocalDB(item);
                updatedCount++;
                console.log(`✅ ${item.title_fr || item.title} : ${changes.join(' | ')}`);
            } else {
                noChangeCount++;
                console.log(`➖ Inchangé : ${item.title_fr || item.title}`);
            }
        } catch (e) { 
            errorCount++;
            console.error(`❌ Erreur sur ${item.title_fr || item.title} : ${e.message}`); 
        }
        await new Promise(r => setTimeout(r, 400));
    }
    console.log(`--- FIN : ${updatedCount} mis à jour, ${noChangeCount} inchangés, ${errorCount} erreurs ---`);
    if (!silent) {
        if (btn) btn.innerHTML = originalContent;
        location.reload();
    }
}
