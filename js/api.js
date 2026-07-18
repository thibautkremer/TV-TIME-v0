'use strict';
// ============================================================
// API — Gestion des appels TMDB, OMDb et Synchronisation
// ============================================================

// --- SYNCHRONISATION SUPABASE (Logique réelle) ---
async function syncSupabase() {
    console.log("Exécution de syncSupabase() en cours...");
    // VOTRE LOGIQUE ACTUELLE DE SYNCHRONISATION SUPABASE DOIT ETRE ICI
}

// --- RÉCUPÉRATION DES NOTES ---
async function getImdbRating(imdbId) {
    try {
        const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.imdbRating && data.imdbRating !== "N/A") ? parseFloat(data.imdbRating) : null;
    } catch (e) { return null; }
}

async function getImdbEpisodeRating(imdbId, season, number) {
    try {
        const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&Season=${season}&Episode=${number}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.imdbRating && data.imdbRating !== "N/A") ? parseFloat(data.imdbRating) : null;
    } catch (e) { return null; }
}

// --- SYNCHRONISATION CLOUD (Interface UI) ---
async function forceSync() {
    const btn = document.getElementById('cloudStatus');
    if (btn) btn.textContent = 'Sync...';
    
    try {
        console.log("--- DÉBUT DE LA SYNCHRONISATION ---");
        
        if (typeof library === 'undefined' || library === null) {
            library = [];
        }

        await syncSupabase();
        
        console.log("✅ Synchronisation réussie.");
        if (btn) {
            btn.textContent = '○ Cloud OK';
            btn.classList.remove('text-gray-400', 'text-red-400');
            btn.classList.add('text-teal-400');
        }
        
        if (typeof renderLibrary === 'function' && !document.getElementById('tab-library').classList.contains('hidden')) {
            renderLibrary();
        }
        
    } catch (error) {
        console.error("Erreur durant la synchro :", error); 
        
        if (btn) {
            btn.textContent = '⚠ Err Sync';
            btn.classList.remove('text-gray-400', 'text-teal-400');
            btn.classList.add('text-red-400');
        }
    }
}

// --- FONCTIONS AUXILIAIRES D'ENRICHISSEMENT ---
async function fetchAllTmdbEpisodes(apiId) {
    let allEps = [];
    try {
        const res = await fetch(`${TMDB_BASE}/tv/${apiId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
        const data = await res.json();
        
        for (let s = 1; s <= data.number_of_seasons; s++) {
            const epRes = await fetch(`${TMDB_BASE}/tv/${apiId}/season/${s}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            const epData = await epRes.json();
            if (epData.episodes) {
                allEps.push(...epData.episodes.map(e => ({
                    id: e.id,
                    season: e.season_number,
                    number: e.episode_number,
                    name: e.name,
                    summary: e.overview,
                    airdate: e.air_date,
                    rating: e.vote_average || 0,
                    watched: false
                })));
            }
        }
    } catch (e) { console.error("Erreur TMDB épisodes", e); }
    return allEps;
}

// CORRECTION MAJEURE: Ajout robuste de médias depuis toutes les sources
async function quickAdd(mediaId, allWatched = false) {
    // 1. Cherche dans toutes les listes possibles
    let media = searchResults.find(r => r.id === mediaId) || 
                discoverResults.find(r => r.id === mediaId) || 
                (typeof modalSuggestionsPool !== 'undefined' ? modalSuggestionsPool.find(r => r.id === mediaId) : null);
    
    // 2. Si introuvable, regarde dans la modale active
    if (!media && typeof window.currentModalMediaObj !== 'undefined' && window.currentModalMediaObj && window.currentModalMediaObj.id === mediaId) {
        media = window.currentModalMediaObj;
    }

    if (!media) {
        console.error("quickAdd: Média introuvable en mémoire pour l'ID", mediaId);
        return;
    }
    
    // Créer une copie propre de l'objet
    const newItem = JSON.parse(JSON.stringify(media));
    newItem.status = allWatched ? 'Watched' : 'In Progress';
    newItem.last_modified = Date.now();
    
    // Suppression du "window." fautif : on utilise la vraie variable library
    if (typeof library === 'undefined' || library === null) library = [];
    library.push(newItem);
    
    if (typeof rebuildLibraryIndex === 'function') rebuildLibraryIndex();
    if (typeof saveLocalDB === 'function') await saveLocalDB(newItem);
    if (typeof updateHeaderCount === 'function') updateHeaderCount(); // Force la MAJ du compteur en haut
    if (typeof renderLibrary === 'function') renderLibrary();
    
    console.log(`✅ Ajouté : ${newItem.title}`);
}
