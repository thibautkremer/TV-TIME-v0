'use strict';
// ============================================================
// STATE — état global mutable partagé entre les modules
// ============================================================

let library = JSON.parse(localStorage.getItem('personal_tracker_db')) || [];
let preferredPlatforms = JSON.parse(localStorage.getItem('preferred_platforms') || '[]');
let syncQueue = JSON.parse(localStorage.getItem('tv_time_sync_queue') || '[]');

let currentMediaType = 'series', searchResults = [];
let showsCache = [];
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

function rebuildLibraryIndex() {
    libraryIndex = new Map();
    libraryTitleIndex = new Map();
    for (const item of library) {
        if (!item || !item.id) continue;
        libraryIndex.set(item.id, item);
        if (item.title) libraryTitleIndex.set(`${item.type}|${item.title.toLowerCase()}`, item);
        if (item.title_fr) libraryTitleIndex.set(`${item.type}|${item.title_fr.toLowerCase()}`, item);
    }
}

function isMediaInLibrary(media) {
    if (!media) return undefined;
    let found = libraryIndex.get(media.id);
    if (found) return found;
    if (media.title) found = libraryTitleIndex.get(`${media.type}|${media.title.toLowerCase()}`);
    if (found) return found;
    if (media.title_fr) found = libraryTitleIndex.get(`${media.type}|${media.title_fr.toLowerCase()}`);
    return found;
}
