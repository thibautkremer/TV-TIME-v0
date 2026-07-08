const CACHE_NAME = 'tvr-cache-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
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
  // RÈGLE D'OR : On n'intercepte que les requêtes de lecture (GET). 
  // Les POST/DELETE vers Supabase doivent passer en direct !
  if (event.request.method !== 'GET') {
      return; 
  }

  // Pour les API externes (TVMaze, Supabase lecture, etc.) : Network First
  if (event.request.url.includes('api.tvmaze.com') || event.request.url.includes('omdbapi.com') || event.request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(async () => {
          const cachedResponse = await caches.match(event.request);
          // Si on n'a rien en cache, on renvoie une réponse "propre" pour éviter le crash
          return cachedResponse || new Response('Offline', { status: 503, statusText: 'Hors-ligne' });
      })
    );
  } else {
    // Pour les fichiers locaux et images : Cache First
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
