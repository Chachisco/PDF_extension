import { state } from './state.js';

export function addNoteToUI(overlay, pageNum, x, y, text) {
    if (!overlay) return;
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.left = `${x}%`;
    note.style.top = `${y}%`;
    note.tabIndex = 0;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.placeholder = 'Escreve a tua nota...';

    note.onclick = event => {
        event.stopPropagation();
        document.querySelectorAll('.sticky-note.active').forEach(item => {
            if (item !== note) item.classList.remove('active');
        });
        note.classList.add('active');
        textarea.focus();
    };
    textarea.onkeydown = event => {
        if (event.key === 'Escape') {
            note.classList.remove('active');
            note.focus();
        }
        if (event.ctrlKey && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault();
            note.remove();
            saveNotesForPage(pageNum, overlay);
        }
    };
    note.onkeydown = event => {
        if (event.key === 'Enter') {
            note.classList.add('active');
            textarea.focus();
        }
        if (event.ctrlKey && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault();
            note.remove();
            saveNotesForPage(pageNum, overlay);
        }
    };
    textarea.oninput = () => saveNotesForPage(pageNum, overlay);
    note.appendChild(textarea);
    overlay.appendChild(note);
    if (text === '') setTimeout(() => { note.classList.add('active'); textarea.focus(); }, 50);
}

export function saveNotesForPage(pageNum, overlay) {
    const notes = Array.from(overlay.querySelectorAll('.sticky-note')).map(note => ({
        x: parseFloat(note.style.left),
        y: parseFloat(note.style.top),
        text: note.querySelector('textarea').value
    }));
    chrome.storage.local.set({ [`${state.currentFilename}_pg${pageNum}_notes`]: notes });
}

export function loadNotesForPage(pageNum) {
    const overlay = document.querySelector(`#page-wrapper-${pageNum} .notes-overlay`);
    if (!overlay) return;
    overlay.innerHTML = '';
    const key = `${state.currentFilename}_pg${pageNum}_notes`;
    chrome.storage.local.get([key], result => {
        (result[key] || []).forEach(note => addNoteToUI(overlay, pageNum, note.x, note.y, note.text));
    });
}