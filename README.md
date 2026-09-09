# Better PDF Viewer

A lightweight, highly optimized Chrome/Brave extension for reading, annotating, and managing local PDF files. Built on top of `pdf.js`, it focuses on performance, distraction-free reading, and powerful annotation tools.

## ✨ Features

* **Smart Header UI Modes:**
  * `Ghost Mode`: The top bar becomes transparent and disappears when idle. It shows only the page counter or the active tool, allowing the PDF to take up the entire screen.
  * `Minimal Mode`: Hides the toolbar when idle, keeping the interface clean.
  * `Fixed Mode`: The classic, always-visible toolbar.
* **Performance Focused:** Uses `IntersectionObserver` to lazy-load and render canvas elements only when they enter the viewport, saving RAM on large documents.
* **Annotation Tools:** Highlight and underline tools with multiple colors (Yellow, Green, Blue, Red) and thickness options. Includes an eraser to remove specific highlights.
* **Interactive Sticky Notes:**
  * Create notes anywhere on the document.
  * **Drag & Drop:** Click and hold the note icon to move it fluidly across the page.
  * **Pinning:** Click the "Pin" icon inside an open note to keep it visible while reading.
  * **Notes Sidebar:** A left-side tracking bar displays yellow markers for every note in the document. Hover to preview the note's text, or click the marker to scroll directly to the page.
* **OS-Aware Path Copying:** Easily copy the local path of the PDF. Smart click detection copies standard Windows paths or converts them to Linux/WSL paths.
* **Navigation:** Smooth lateral slider for horizontal panning and precise "Fit to Width / Fit to Height" zoom controls.

## ⌨️ Shortcuts & Usage

### General Navigation

* **`H` / `h`**: Cycle through Header UI modes (Fixed -> Ghost -> Minimal).
* **`Ctrl` + `+` / `-` / `0`**: Zoom in, zoom out, or reset zoom.
* **`Arrow Keys`**: Smoothly snap to the previous or next page (exactly aligned with the top of the viewport).

### Sticky Notes

* **Create a note**: `Ctrl` + `Left Click` anywhere on the page, OR click the Add Note button in the header (creates a note in the center of the current page).
* **Move a note**: Click and drag the yellow marker.
* **Delete a note**: Focus on a note and press `Ctrl` + `Delete` (or `Backspace`), OR click the trash bin icon inside the note.

### Utilities

* **Copy File Path Button**:
  * `Left Click`: Copies Windows path (e.g., `C:\...`)
  * `Right Click`: Copies Linux/WSL path (e.g., `/mnt/c/...` or `/home/...`)

## 🛠️ Installation

1. Clone or download this repository.
2. Open your browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extension folder.
