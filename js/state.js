'use strict';
// ============================================================
// STATE — état global mutable partagé entre les modules
// ============================================================

let library = []; 
let preferredPlatforms = JSON.parse(localStorage.getItem('preferred_platforms') || '[]');
let syncQueue = JSON.parse(localStorage.getItem('tv_time_sync_queue') || '[]');

let currentMediaType = 'series', searchResults = [];
let activeModalMediaIndex = null, modalMode = 'preview', previewEpisodes = [];
let calFilter = 'all';
let currentSeriesAvgRating = 7.0;
let currentDiscoverMode = 'mix';
let discoverMediaType = 'series';
let searchPage = 1, discoverPage = 1;
let discoverResults = [];
let todayString = new Date().toISOString().split('T')[0];

let modalSuggestionsPool = [];
let modalSuggestionsPage = 1;
let currentModalMediaId = null;

window.activeGlobalFilter = null;

let libraryIndex = new Map();
let libraryTitleIndex = new Map();

let searchDebounceTimer = null;

/**
 * Reconstruit l'index de la bibliothèque basé sur l'ID unique TMDB (ex: 'series-123')
 * pour éviter les conflits d'homonymie.
 */
function rebuildLibraryIndex() {
    libraryIndex = new Map();
    libraryTitleIndex = new Map();
    for (const item of library) {
        if (!item || !item.id) continue;
        libraryIndex.set(item.id, item);
        // Indexation secondaire par titre au cas où
        if (item.title) libraryTitleIndex.set(`${item.type}|${item.title.toLowerCase()}`, item);
        if (item.title_fr) libraryTitleIndex.set(`${item.type}|${item.title_fr.toLowerCase()}`, item);
    }
}

/**
 * Vérifie la présence d'un média dans la bibliothèque via son ID unique.
 */
function isMediaInLibrary(media) {
    if (!media) return undefined;
    
    // 1. Recherche par le nouvel ID strict (ex: 'series-123')
    let found = libraryIndex.get(media.id);
    if (found) return found;

    // 2. Fallback API ID : Pour rattraper les anciens médias OMDB/TVMaze
    if (media.apiId) {
        found = library.find(i => String(i.apiId) === String(media.apiId) || String(i.id) === String(media.apiId));
        if (found) return found;
    }

    // 3. Fallback Titre : Dernier rempart anti-doublon
    if (media.title) {
        found = libraryTitleIndex.get(`${media.type}|${media.title.toLowerCase()}`);
        if (found) return found;
    }
    if (media.title_fr) {
        found = libraryTitleIndex.get(`${media.type}|${media.title_fr.toLowerCase()}`);
        if (found) return found;
    }

    return undefined;
}
