import * as pdfjsLib from './lib/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.mjs';

const container = document.getElementById('pages-container');
const viewport = document.getElementById('viewport');
const slider = document.getElementById('lateral-slider');
const header = document.getElementById('mini-header');
const pageInput = document.getElementById('page-input');
const zoomInput = document.getElementById('zoom-percent');
const btnHeaderMode = document.getElementById('btn-header-mode');
const fileInput = document.getElementById('file-input');

let pdfDoc = null, currentFilename = "", currentScale = 1.0;
let headerMode = 'minimal';
const renderTasks = {};
const renderingStates = {};
const textLayerTasks = {};

async function loadPDF(source, filename) {
    currentFilename = filename;
    document.title = filename || 'UniPDF Pro';
    const loadingTask = pdfjsLib.getDocument(
        typeof source === 'string' ? { url: source } : { data: source }
    );
    pdfDoc = await loadingTask.promise;
    document.getElementById('page-count').textContent = pdfDoc.numPages;
    
    container.innerHTML = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.id = `page-wrapper-${i}`;
        wrapper.dataset.pageNumber = i;
        
        // Estrutura: Canvas (Fundo) -> Text (Meio) -> Notes (Topo)
        wrapper.innerHTML = `
            <canvas></canvas>
            <div class="textLayer"></div>
            <div class="notes-overlay"></div>
        `;
        container.appendChild(wrapper);
    }
    setupObserver();
}

async function renderPage(num) {
    const wrapper = document.getElementById(`page-wrapper-${num}`);
    if (!wrapper || renderingStates[num]) return;
    
    // Se já estiver renderizado com este zoom, apenas carrega as notas
    if (wrapper.dataset.rendered === "true" && wrapper.dataset.scale == currentScale) {
        loadNotesForPage(num);
        return;
    }

    renderingStates[num] = true;
    const dpr = window.devicePixelRatio || 1;

    try {
        const page = await pdfDoc.getPage(num);
        const vport = page.getViewport({ scale: currentScale });
        
        const canvas = wrapper.querySelector('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });

        // Ajuste de Resolução (DPR)
        canvas.width = Math.floor(vport.width * dpr);
        canvas.height = Math.floor(vport.height * dpr);
        canvas.style.width = Math.floor(vport.width) + "px";
        canvas.style.height = Math.floor(vport.height) + "px";
        
        wrapper.style.width = canvas.style.width;
        wrapper.style.height = canvas.style.height;

        const renderContext = { 
            canvasContext: ctx, 
            viewport: vport,
            transform: [dpr, 0, 0, dpr, 0, 0]
        };

        if (renderTasks[num]) renderTasks[num].cancel();
        const renderTask = page.render(renderContext);
        renderTasks[num] = renderTask;
        await renderTask.promise;

        // --- RENDERIZAR CAMADA DE TEXTO ---
        const textLayerDiv = wrapper.querySelector('.textLayer');
        textLayerDiv.innerHTML = "";
        textLayerDiv.style.setProperty('--scale-factor', currentScale);
        textLayerDiv.style.setProperty('--total-scale-factor', currentScale);

        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: vport
        });
        textLayerTasks[num] = textLayer;
        await textLayer.render();

        wrapper.dataset.rendered = "true";
        wrapper.dataset.scale = currentScale;
        loadNotesForPage(num);
    } catch (err) {
        if (err.name !== "RenderingCancelledException") console.error(err);
    } finally {
        renderingStates[num] = false;
        renderTasks[num] = null;
        textLayerTasks[num] = null;
        if (wrapper && wrapper.dataset.scale != currentScale) renderPage(num);
    }
}

function setupObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const num = parseInt(entry.target.dataset.pageNumber);
                renderPage(num);
                pageInput.value = num;
                chrome.storage.local.set({ [currentFilename]: num });
            }
        });
    }, { root: viewport, threshold: 0.1 });
    document.querySelectorAll('.page-wrapper').forEach(p => observer.observe(p));
}

// --- 2. STICKY NOTES ---
container.onclick = (e) => {
    // Se clicou num pino ou textarea, não faz nada
    if (e.target.closest('.sticky-note') || e.target.tagName === "TEXTAREA") return;

    // Só cria se o CTRL estiver premido
    if (e.ctrlKey) {
        const wrapper = e.target.closest('.page-wrapper');
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        addNoteToUI(wrapper.querySelector('.notes-overlay'), wrapper.dataset.pageNumber, x, y, "");
    } else {
        // Clique normal: fecha notas ativas
        document.querySelectorAll('.sticky-note.active').forEach(n => n.classList.remove('active'));
    }
};

function addNoteToUI(overlay, pgNum, x, y, text) {
    if (!overlay) return;
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.left = `${x}%`;
    note.style.top = `${y}%`;
    note.tabIndex = 0; // Permite foco no pino para detetar teclas

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.placeholder = "Escreve a tua nota...";

    // Abrir/Focar ao clicar
    note.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.sticky-note.active').forEach(n => {
            if (n !== note) n.classList.remove('active');
        });
        note.classList.add('active');
        textarea.focus();
    };

    // Atalhos dentro da Textarea
    textarea.onkeydown = (e) => {
        if (e.key === "Escape") {
            note.classList.remove('active');
            note.focus(); // Volta o foco para o pino
        }
        
        // APAGAR NOTA: Ctrl + Delete ou Ctrl + Backspace
        if (e.ctrlKey && (e.key === "Delete" || e.key === "Backspace")) {
            // Só apaga se estiver vazia OU se usarmos o atalho de força (Ctrl)
            note.remove();
            saveNotesForPage(pgNum, overlay);
        }
    };

    // Atalhos quando apenas o PINO está focado
    note.onkeydown = (e) => {
        if (e.key === "Enter") {
            note.classList.add('active');
            textarea.focus();
        }
        // Se o pino estiver focado, Delete ou Backspace apagam logo
        if (e.key === "Delete" || e.key === "Backspace") {
            note.remove();
            saveNotesForPage(pgNum, overlay);
        }
    };

    textarea.oninput = () => saveNotesForPage(pgNum, overlay);
    
    // Clique direito apaga sempre
    note.oncontextmenu = (e) => {
        e.preventDefault();
        note.remove();
        saveNotesForPage(pgNum, overlay);
    };

    note.appendChild(textarea);
    overlay.appendChild(note);

    // Se for uma nota nova (vazia), abre logo
    if (text === "") {
        setTimeout(() => {
            note.classList.add('active');
            textarea.focus();
        }, 50);
    }
}

viewport.onclick = () => {
    document.querySelectorAll('.sticky-note.active').forEach(n => n.classList.remove('active'));
};

function saveNotesForPage(pgNum, overlay) {
    const notes = Array.from(overlay.querySelectorAll('.sticky-note')).map(n => ({
        x: parseFloat(n.style.left),
        y: parseFloat(n.style.top),
        text: n.querySelector('textarea').value
    }));
    chrome.storage.local.set({ [`${currentFilename}_pg${pgNum}_notes`]: notes });
}

function loadNotesForPage(pgNum) {
    const overlay = document.querySelector(`#page-wrapper-${pgNum} .notes-overlay`);
    if (!overlay) return;
    overlay.innerHTML = "";
    chrome.storage.local.get([`${currentFilename}_pg${pgNum}_notes`], (res) => {
        const notes = res[`${currentFilename}_pg${pgNum}_notes`] || [];
        notes.forEach(n => addNoteToUI(overlay, pgNum, n.x, n.y, n.text));
    });
}

// --- 3. ZOOM ---
function updateZoom(newScale) {
    currentScale = Math.min(Math.max(0.1, newScale), 5.0);
    zoomInput.value = Math.round(currentScale * 100) + "%";
    
    document.querySelectorAll('.page-wrapper').forEach(w => {
        w.dataset.rendered = "false";
    });
    Object.values(textLayerTasks).forEach(task => task?.cancel());
    Object.values(renderTasks).forEach(task => task?.cancel());
    renderVisiblePages();
    saveState();
}

// Zoom por ENTER
zoomInput.onkeydown = (e) => {
    if (e.key === "Enter") {
        const val = parseInt(zoomInput.value);
        if (!isNaN(val)) updateZoom(val / 100);
        zoomInput.blur();
    }
};

function renderVisiblePages() {
    document.querySelectorAll('.page-wrapper').forEach(w => {
        const rect = w.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) renderPage(parseInt(w.dataset.pageNumber));
    });
}

// --- 4. INTERFACE ---
function setHeaderMode(mode) {
    headerMode = mode;
    header.className = `mode-${mode}`;
    const icons = { 'ghost': '👻', 'minimal': '📄', 'fixed': '📌' };
    btnHeaderMode.innerText = icons[mode];
    saveState();
}

btnHeaderMode.onclick = (e) => {
    const modes = ['ghost', 'minimal', 'fixed'];
    setHeaderMode(modes[(modes.indexOf(headerMode) + 1) % 3]);
};

document.getElementById('btn-zoom-in').onclick = () => updateZoom(currentScale + 0.1);
document.getElementById('btn-zoom-out').onclick = () => updateZoom(currentScale - 0.1);

document.getElementById('btn-fit-width').onclick = async () => {
    const page = await pdfDoc.getPage(1);
    updateZoom((window.innerWidth - 80) / page.getViewport({scale:1}).width);
};

document.getElementById('btn-fit-height').onclick = async () => {
    const page = await pdfDoc.getPage(1);
    updateZoom((window.innerHeight - 100) / page.getViewport({scale:1}).height);
};

slider.oninput = () => container.style.transform = `translateX(${slider.value * 10}px)`;

// BLOQUEAR ZOOM DO BROWSER (CTRL + +/-/0)
window.addEventListener('keydown', (e) => {
    // IMPORTANTE: Não mudar de página se estiveres a escrever na nota!
    if (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT") {
        if (e.key === "Escape") document.activeElement.blur();
        return;
    }

    if (e.ctrlKey && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
        e.preventDefault();
        if (e.key === "+" || e.key === "=") updateZoom(currentScale + 0.1);
        if (e.key === "-") updateZoom(currentScale - 0.1);
        if (e.key === "0") updateZoom(1.0);
        return;
    }

    if (e.key.toLowerCase() === 'h') {
        const modes = ['ghost', 'minimal', 'fixed'];
        setHeaderMode(modes[(modes.indexOf(headerMode) + 1) % 3]);
    }

    // Setas para mudar de página (melhorado para scroll suave)
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const current = parseInt(pageInput.value);
        const next = document.getElementById(`page-wrapper-${current + 1}`);
        if (next) next.scrollIntoView({ behavior: 'smooth' });
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const current = parseInt(pageInput.value);
        const prev = document.getElementById(`page-wrapper-${current - 1}`);
        if (prev) prev.scrollIntoView({ behavior: 'smooth' });
    }
}, { capture: true });

// BLOQUEAR ZOOM DO BROWSER (CTRL + RODA DO RATO)
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        updateZoom(currentScale + (e.deltaY > 0 ? -0.1 : 0.1));
    }
}, { passive: false });

// --- 5. INIT ---
function saveState() { chrome.storage.local.set({ [currentFilename + "_zoom"]: currentScale, "global_header_mode": headerMode }); }

async function init() {
    const fileUrl = new URLSearchParams(window.location.search).get('file');
    if (fileUrl) {
        const decodedUrl = decodeURIComponent(fileUrl);
        await loadPDF(decodedUrl, decodedUrl.split('/').pop().split(/[?#]/)[0]);
        chrome.storage.local.get([currentFilename, currentFilename + "_zoom", "global_header_mode"], (res) => {
            if (res[currentFilename + "_zoom"]) currentScale = res[currentFilename + "_zoom"];
            setHeaderMode(res.global_header_mode || 'ghost');
            updateZoom(currentScale);
            if (res[currentFilename]) {
                setTimeout(() => {
                    const el = document.getElementById(`page-wrapper-${res[currentFilename]}`);
                    if (el) el.scrollIntoView();
                }, 500);
            }
        });
    } else {
        fileInput.click();
    }
}

fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    await loadPDF(await file.arrayBuffer(), file.name);
    chrome.storage.local.get([currentFilename, currentFilename + "_zoom", "global_header_mode"], (res) => {
        if (res[currentFilename + "_zoom"]) currentScale = res[currentFilename + "_zoom"];
        setHeaderMode(res.global_header_mode || 'ghost');
        updateZoom(currentScale);
        if (res[currentFilename]) {
            document.getElementById(`page-wrapper-${res[currentFilename]}`)?.scrollIntoView();
        }
    });
};

init();