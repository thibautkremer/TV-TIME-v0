'use strict';
// ============================================================
// CALENDAR — onglet "Sorties" (épisodes et films à venir)
// ============================================================

function getCalendarEntries() {
    const entries = [];
    library.forEach(item => {
        if (item.status === 'Abandoned') return;
        if (item.type === 'series') {
            (item.episodes || []).forEach(ep => {
                // Seulement les épisodes non vus avec une date >= aujourd'hui
                if (!ep.watched && ep.airdate && ep.airdate >= todayString) {
                    entries.push({ date: ep.airdate, type: 'episode', mediaId: item.id, title: item.title_fr || item.title, subtitle: `S${ep.season}E${ep.number}${ep.name ? ' – ' + ep.name : ''}`, image: item.image, original_language: item.original_language, genres: item.genres });
                }
            });
        } else if (item.type === 'movie') {
            // Seulement les films non vus avec une date de sortie complète >= aujourd'hui
            if (item.releaseDate && item.releaseDate >= todayString && item.status !== 'Watched') {
                entries.push({ date: item.releaseDate, type: 'movie', mediaId: item.id, title: item.title_fr || item.title, subtitle: 'Sortie film', image: item.image, original_language: item.original_language, genres: item.genres });
            }
        }
    });
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
}

function renderCalendar() {
    const container = document.getElementById('calendarTimeline');
    let entries = getCalendarEntries();

    // On affiche par défaut uniquement les sorties à partir d'aujourd'hui
    entries = entries.filter(e => e.date >= todayString);

    if (entries.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 text-sm py-10">Aucune sortie à afficher.</p>'; return; }

    const grouped = {};
    entries.forEach(e => { (grouped[e.date] = grouped[e.date] || []).push(e); });

    const frag = document.createDocumentFragment();
    Object.keys(grouped).sort().forEach(date => {
        const dayWrap = document.createElement('div');
        const isToday = date === todayString;
        const dateObj = new Date(date + 'T00:00:00');
        const label = isToday ? "Aujourd'hui" : dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        dayWrap.innerHTML = `<h3 class="text-xs font-bold ${isToday ? 'text-teal-400' : 'text-gray-400'} uppercase tracking-wider mb-1.5 mt-3">${label}</h3>`;
        const list = document.createElement('div'); list.className = 'space-y-1.5';
        grouped[date].forEach(e => {
            const isAnime = (e.genres || []).includes('Anime') || (e.genres || []).includes('Animation') || e.original_language === 'ja';
            const colorClass = e.type === 'movie' ? 'bg-red-900/40' : (isAnime ? 'bg-purple-900/40' : 'bg-blue-900/40');

            const row = document.createElement('div');
            row.className = `flex items-center gap-3 border border-gray-700 rounded-xl p-2 cursor-pointer hover:border-gray-500 transition ${colorClass}`;
            row.onclick = () => openLibraryModal(e.mediaId);
            const icon = e.type === 'movie' ? '🍿' : '📺';
            row.innerHTML = `<img src="${getOptimizedImageUrl(e.image, 80)}" class="w-9 h-12 object-cover rounded border border-gray-700 shrink-0" /><div class="min-w-0 flex-1"><p class="text-xs font-bold text-white truncate">${icon} ${e.title}</p><p class="text-[10px] text-gray-400 truncate">${e.subtitle}</p></div>`;
            list.appendChild(row);
        });
        dayWrap.appendChild(list);
        frag.appendChild(dayWrap);
    });
    container.innerHTML = '';
    container.appendChild(frag);
}
