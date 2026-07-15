'use strict';
async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const items = library.filter(i => i.type === type);
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        if (!silent && btn) btn.innerHTML = `⏳ [${i + 1}/${items.length}] ${item.title_fr}`;
        try {
            const res = await fetch(`${TMDB_BASE}/${type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`);
            const data = await res.json();
            let changed = false;

            // Notes séries
            if (type === 'series') {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                item.episodes.forEach(ep => {
                    const fresh = allEps.find(e => e.season === ep.season && e.number === ep.number);
                    if (fresh && fresh.rating !== ep.rating) { ep.rating = fresh.rating; changed = true; }
                });
            }
            if (changed) { await saveLocalDB(item); console.log(`✅ ${item.title_fr} mis à jour.`); }
            else console.log(`➖ ${item.title_fr} OK.`);
        } catch (e) { console.error(`❌ Erreur ${item.title_fr}`); }
    }
    if (!silent) location.reload();
}
