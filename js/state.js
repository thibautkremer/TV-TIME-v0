'use strict';
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

function rebuildLibraryIndex() {
    libraryIndex = new Map();
    for (const item of library) { if (item && item.id) libraryIndex.set(item.id, item); }
}

function isMediaInLibrary(media) {
    if (!media || !media.id) return undefined;
    return libraryIndex.get(media.id);
}
