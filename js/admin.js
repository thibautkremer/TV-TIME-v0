'use strict';
async function massUpdateLibrary(type, silent = false) {
    const btn = document.getElementById(type === 'series' ? 'btn-mass-update-series' : 'btn-mass-update-movie');
    const itemsToProcess = library.filter(i => i.type === type);
    const total = itemsToProcess.length;

    for (let i = 0; i < total; i++) {
        let item = itemsToProcess[i];
        if (!silent && btn) btn.innerHTML = `⏳ [${i + 1}/${total}] ${item.title_fr || item.title}`;
        console.log(`[MAJ] (${i + 1}/${total}) Traitement : ${item.title_fr || item.title}`);

        try {
            const res = await fetch(`${TMDB_BASE}/${type}/${item.apiId}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=watch/providers`);
            const data = await res.json();
            let changed = false;

            if (type === 'movie' && data['watch/providers']?.results?.FR?.flatrate?.[0]?.provider_name) {
                if (item.network !== data['watch/providers'].results.FR.flatrate[0].provider_name) { item.network = data['watch/providers'].results.FR.flatrate[0].provider_name; changed = true; }
            }
            if (type === 'series') {
                const allEps = await fetchAllTmdbEpisodes(item.apiId);
                item.episodes.forEach(ep => {
                    const fresh = allEps.find(e => e.season === ep.season && e.number === ep.number);
                    if (fresh && fresh.rating !== ep.rating) { ep.rating = fresh.rating; changed = true; }
                });
            }
            if (changed) { item.last_modified = Date.now(); await saveLocalDB(item); console.log(`✅ ${item.title} mis à jour.`); }
            else console.log(`➖ ${item.title} : aucune mise à jour.`);
        } catch (e) { console.error(`❌ Erreur ${item.title}`, e); }
        await new Promise(r => setTimeout(r, 400));
    }
    if (!silent) location.reload();
}
