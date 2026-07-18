'use strict';
// ============================================================
// API — Gestion des appels TMDB, OMDb et Synchronisation
// ============================================================

// --- SYNCHRONISATION SUPABASE (Logique réelle) ---
// Placez ici votre vraie fonction de synchro pour être sûr qu'elle soit trouvée
async function syncSupabase() {
    console.log("Exécution de syncSupabase() en cours...");
    // VOTRE LOGIQUE ACTUELLE DE SYNCHRONISATION SUPABASE DOIT ETRE ICI
    // Exemple : const { data, error } = await supabase.from('...')...
    // Si vous aviez ce code ailleurs, copiez-le ici.
}

// --- RÉCUPÉRATION DES NOTES ---

// Note Globale (Film)
async function getImdbRating(imdbId) {
    try {
        const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.imdbRating && data.imdbRating !== "N/A") ? parseFloat(data.imdbRating) : null;
    } catch (e) { return null; }
}

// Note Episode (Série/Anime)
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

        // Appel direct de la fonction définie dans ce même fichier
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

async function quickAdd(mediaId, allWatched = false) {
    const media = searchResults.find(r => r.id === mediaId) || discoverResults.find(r => r.id === mediaId);
    if (!media) return;
    media.status = allWatched ? 'Watched' : 'In Progress';
    media.last_modified = Date.now();
    library.push(media);
    await saveLocalDB(media);
    renderLibrary();
    console.log(`✅ Ajouté : ${media.title}`);
}
