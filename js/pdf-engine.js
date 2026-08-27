import * as pdfjsLib from '../lib/pdf.mjs';
import { state } from './state.js';
import { loadAnnotationsForPage } from './annotations.js';
import { loadNotesForPage } from './notes.js';
import { saveState } from './storage.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.mjs';

const container = document.getElementById('pages-container');
const viewport = document.getElementById('viewport');
const pageInput = document.getElementById('page-input');

export async function loadPDF(source, filename) {
    state.currentFilename = filename;
    document.title = filename || 'UniPDF Pro';
    const loadingTask = pdfjsLib.getDocument(typeof source === 'string' ? { url: source } : { data: source });
    state.pdfDoc = await loadingTask.promise;
    document.getElementById('page-count').textContent = state.pdfDoc.numPages;
    container.innerHTML = '';
    for (let pageNum = 1; pageNum <= state.pdfDoc.numPages; pageNum++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.id = `page-wrapper-${pageNum}`;
        wrapper.dataset.pageNumber = pageNum;
        wrapper.innerHTML = '<canvas></canvas><div class="annotation-layer"></div><div class="textLayer"></div><div class="notes-overlay"></div>';
        container.appendChild(wrapper);
    }
    setupObserver();
}

export async function renderPage(pageNum) {
    const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
    if (!wrapper || state.renderingStates[pageNum]) return;
    if (wrapper.dataset.rendered === 'true' && Number(wrapper.dataset.scale) === state.currentScale) {
        loadNotesForPage(pageNum);
        loadAnnotationsForPage(pageNum);
        return;
    }
    state.renderingStates[pageNum] = true;
    const dpr = window.devicePixelRatio || 1;
    try {
        const page = await state.pdfDoc.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: state.currentScale });
        const canvas = wrapper.querySelector('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(pageViewport.width * dpr);
        canvas.height = Math.floor(pageViewport.height * dpr);
        canvas.style.width = `${Math.floor(pageViewport.width)}px`;
        canvas.style.height = `${Math.floor(pageViewport.height)}px`;
        wrapper.style.width = canvas.style.width;
        wrapper.style.height = canvas.style.height;
        if (state.renderTasks[pageNum]) state.renderTasks[pageNum].cancel();
        const renderTask = page.render({ canvasContext: context, viewport: pageViewport, transform: [dpr, 0, 0, dpr, 0, 0] });
        state.renderTasks[pageNum] = renderTask;
        await renderTask.promise;

        const textLayerDiv = wrapper.querySelector('.textLayer');
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.setProperty('--scale-factor', state.currentScale);
        textLayerDiv.style.setProperty('--total-scale-factor', state.currentScale);
        const textLayer = new pdfjsLib.TextLayer({
            textContentSource: await page.getTextContent(),
            container: textLayerDiv,
            viewport: pageViewport
        });
        state.textLayerTasks[pageNum] = textLayer;
        await textLayer.render();
        wrapper.dataset.rendered = 'true';
        wrapper.dataset.scale = state.currentScale;
        loadNotesForPage(pageNum);
        loadAnnotationsForPage(pageNum);
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') console.error(error);
    } finally {
        state.renderingStates[pageNum] = false;
        state.renderTasks[pageNum] = null;
        if (wrapper && Number(wrapper.dataset.scale) !== state.currentScale) renderPage(pageNum);
    }
}

function setupObserver() {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
        renderPage(pageNum);
        pageInput.value = pageNum;
        chrome.storage.local.set({ [state.currentFilename]: pageNum });
    }), { root: viewport, threshold: 0.1 });
    document.querySelectorAll('.page-wrapper').forEach(page => observer.observe(page));
}

export function renderVisiblePages() {
    document.querySelectorAll('.page-wrapper').forEach(wrapper => {
        const rect = wrapper.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) renderPage(parseInt(wrapper.dataset.pageNumber, 10));
    });
}

export function updateZoom(newScale) {
    state.currentScale = Math.min(Math.max(0.1, newScale), 5);
    document.getElementById('zoom-percent').value = `${Math.round(state.currentScale * 100)}%`;
    document.querySelectorAll('.page-wrapper').forEach(wrapper => { wrapper.dataset.rendered = 'false'; });
    Object.values(state.textLayerTasks).forEach(task => task?.cancel());
    Object.values(state.renderTasks).forEach(task => task?.cancel());
    renderVisiblePages();
    saveState();
}

export async function fitWidth() {
    const page = await state.pdfDoc.getPage(1);
    updateZoom((window.innerWidth - 80) / page.getViewport({ scale: 1 }).width);
}

export async function fitHeight() {
    const page = await state.pdfDoc.getPage(1);
    updateZoom((window.innerHeight - 100) / page.getViewport({ scale: 1 }).height);
}