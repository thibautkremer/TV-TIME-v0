const CACHE_NAME = 'tvr-cache-v4';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/state.js',
  './js/utils.js',
  './js/db.js',
  './js/api.js',
  './js/notifications.js',
  './js/cards.js',
  './js/search.js',
  './js/discover.js',
  './js/library.js',
  './js/calendar.js',
  './js/modal.js',
  './js/suggestions.js',
  './js/profile.js',
  './js/admin.js',
  './js/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
      return; 
  }

  // Seules les API de TMDB et OMDB sont gardées (Supabase et Tailwind CDN retirés pour éviter les erreurs CORS locales)
  if (event.request.url.includes('themoviedb.org') || event.request.url.includes('omdbapi.com')) {
    event.respondWith(
      fetch(event.request).catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || new Response('Offline', { status: 503, statusText: 'Hors-ligne' });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
