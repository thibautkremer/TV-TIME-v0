'use strict';
// ============================================================
// API — Gestion des appels TMDB, OMDb et Synchronisation
// ============================================================

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

// --- SYNCHRONISATION CLOUD ---

async function forceSync() {
    const btn = document.getElementById('cloudStatus');
    if (btn) btn.textContent = 'Sync...';
    
    try {
        console.log("--- DÉBUT DE LA SYNCHRONISATION ---");
        
        // Sécurité anti-crash si la base locale a été vidée
        if (typeof library === 'undefined' || library === null) {
            library = [];
        }

        if (library.length === 0) {
            console.log("Bibliothèque locale vide. Téléchargement depuis le Cloud prioritaire...");
        }

        // Lancement de la synchro Supabase (adaptez selon votre implémentation réelle)
        if (typeof syncSupabase === 'function') {
            await syncSupabase();
        } else if (typeof syncData === 'function') {
            await syncData();
        } else {
            throw new Error("Fonction de synchronisation introuvable.");
        }
        
        console.log("✅ Synchronisation réussie.");
        if (btn) {
            btn.textContent = '○ Cloud OK';
            btn.classList.remove('text-gray-400', 'text-red-400');
            btn.classList.add('text-teal-400');
        }
        
        // Rafraîchissement de l'UI si nécessaire
        if (typeof renderLibrary === 'function' && !document.getElementById('tab-library').classList.contains('hidden')) {
            renderLibrary();
        }
        
    } catch (error) {
        console.error(error); 
        
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
    } catch (e) { console.error("Erreur lors de la récupération des épisodes TMDB", e); }
    return allEps;
}

// Fonction d'ajout rapide (QuickAdd)
async function quickAdd(mediaId, allWatched = false) {
    // Logique simplifiée pour ajouter un média
    const media = searchResults.find(r => r.id === mediaId) || discoverResults.find(r => r.id === mediaId);
    if (!media) return;
    
    // Ajout à la bibliothèque locale
    media.status = allWatched ? 'Watched' : 'In Progress';
    media.last_modified = Date.now();
    library.push(media);
    await saveLocalDB(media);
    renderLibrary();
    console.log(`✅ Ajouté : ${media.title}`);
}

