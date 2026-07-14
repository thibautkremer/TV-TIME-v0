'use strict';
// ============================================================
// NOTIFICATIONS — permission et rappels de sorties quotidiens
// ============================================================

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") { alert("Notifications activées !"); checkDailyNotifications(); } else { alert("Permission refusée."); }
        });
    } else { alert("Non supporté."); }
}

function checkDailyNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const notified = JSON.parse(localStorage.getItem('notified_items_v2') || '[]');
    let newNotifs = [];
    library.forEach(item => {
        if (item.type === 'movie' && item.premiered === todayString && item.status !== 'Watched') {
            const nid = `movie-${item.id}-${todayString}`;
            if (!notified.includes(nid)) newNotifs.push({ title: "Sortie Film 🍿", body: `${item.title_fr || item.title} sort aujourd'hui !`, id: nid });
        } else if (item.type === 'series') {
            (item.episodes || []).forEach(ep => {
                if (ep.airdate === todayString && !ep.watched) {
                    const nid = `ep-${item.id}-${ep.season}-${ep.number}`;
                    if (!notified.includes(nid)) newNotifs.push({ title: "Nouvel Épisode 📺", body: `${item.title_fr || item.title} S${ep.season}E${ep.number} est dispo !`, id: nid });
                }
            });
        }
    });
    if (newNotifs.length > 0) {
        newNotifs.forEach(n => { try { new Notification(n.title, { body: n.body }); } catch (e) {} notified.push(n.id); });
        localStorage.setItem('notified_items_v2', JSON.stringify(notified));
    }
}
