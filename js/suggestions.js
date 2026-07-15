'use strict';
function appendSuggestions() {
    const list = document.getElementById('modalSuggestionsList');
    list.innerHTML = '';
    modalSuggestionsPool.slice(0, 10).forEach(n => {
        const div = document.createElement('div');
        div.className = 'bg-gray-900 border border-gray-700 p-2 rounded-xl flex gap-3 items-center';
        div.innerHTML = `
            <img src="${getOptimizedImageUrl(n.image, 100)}" class="w-10 h-14 object-cover rounded cursor-pointer" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})" />
            <div class="flex-1 cursor-pointer text-[11px]" onclick="closeModal(); openPreviewModal(${JSON.stringify(n).replace(/"/g, '&quot;')})">
                <h4 class="font-bold text-white truncate">${n.title_fr}</h4>
            </div>
            <div class="w-24">${buildCardActionsHTML(n)}</div>`;
        list.appendChild(div);
    });
}
