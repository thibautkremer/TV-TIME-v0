'use strict';
// ============================================================
// UTILS — helpers génériques (images, notes, durées, lazy-load)
// ============================================================

const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); img.classList.add('lazy-loaded'); }
            observer.unobserve(img);
        }
    });
}, { rootMargin: '150px 0px', threshold: 0.01 });

function observeLazyImages() {
    document.querySelectorAll('img.lazy-image:not(.observed)').forEach(img => { img.classList.add('observed'); imageObserver.observe(img); });
}

function getOptimizedImageUrl(url, width = 300) {
    if (!url || url === 'N/A' || url === 'image_par_defaut.jpg') return 'https://placehold.co/150x220/1f2937/a1a1aa?text=No+Image';
    if (url.includes('tmdb.org')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&w=${width}`;
}

function getCalculatedRating(media) {
    if (media.type === 'series' && media.episodes && media.episodes.length > 0) {
        let total = 0, count = 0;
        media.episodes.forEach(e => { const r = (typeof e.rating === 'object' && e.rating !== null) ? e.rating.average : parseFloat(e.rating); if (r && !isNaN(r) && r > 0) { total += r; count++; } });
        if (count > 0) return parseFloat((total / count).toFixed(1));
    }
    return (media.rating && !isNaN(media.rating) && media.rating > 0) ? parseFloat(media.rating) : 0;
}

function computeAvgEpisodeRating(eps) {
    const valid = (eps || []).map(e => (typeof e.rating === 'object' && e.rating !== null) ? (e.rating.average || 0) : (parseFloat(e.rating) || 0)).filter(r => r > 0);
    if (valid.length === 0) return 7.0;
    return parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
}

function getProgress(item) {
    if (!item.episodes || item.episodes.length === 0) return item.status === 'Watched' ? 100 : 0;
    const watched = item.episodes.filter(e => e.watched).length;
    return Math.round((watched / item.episodes.length) * 100);
}

function formatDurationProfile(totalMin) {
    if (isNaN(totalMin) || totalMin <= 0) return '0 h';
    let r = Math.max(0, Math.round(totalMin));
    const y = Math.floor(r / 525600); r -= y * 525600;
    const mo = Math.floor(r / 43200); r -= mo * 43200;
    const d = Math.floor(r / 1440); r -= d * 1440;
    const h = Math.floor(r / 60); const m = r % 60;
    const p = [];
    if (y) p.push(`${y} an(s)`); if (mo) p.push(`${mo} mois`); if (d) p.push(`${d} j`); if (h) p.push(`${h} h`); if (m) p.push(`${m} min`);
    return p.join(' ');
}

function toggleEpisodeDescription(element) {
    const desc = element.querySelector('.episode-desc');
    if (desc) desc.classList.toggle('hidden');
}

function togglePosterSize(img) {
    if (img.classList.contains('fixed')) img.className = 'w-20 h-28 object-cover rounded border border-gray-700 shrink-0 cursor-pointer transition-all duration-300 z-50';
    else img.className = 'fixed inset-0 z-[100] w-full h-full object-contain bg-black/95 p-4 cursor-pointer transition-all duration-300';
}
