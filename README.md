# OkazuStudio

OkazuStudio is a powerful, client-side web application designed for compositing and editing images directly in your browser. It enables users to seamlessly blend two images (Slots A and B) using advanced masking tools and pixel-level adjustments without uploading data to external servers.

## Features

*   **Dual-Image Compositing**: Load two images and blend them using a versatile masking system.
*   **Advanced Masking**: Use "Erase" and "Repair" brush modes to reveal or hide layers.
    *   Adjustable brush size and hardness/feathering.
    *   Polyline drawing support (Ctrl + Click).
*   **Detailed Adjustments**: Fine-tune your images with a comprehensive suite of tools:
    *   **Exposure**: Gamma, Shadows, Highlights.
    *   **Levels**: Black point, Mid point, White point.
    *   **Color**: Saturation, Vibrance, White Balance.
    *   **Color Balance**: Cyan/Red, Magenta/Green, Yellow/Blue channels.
*   **Productivity Tools**:
    *   Robust **Undo/Redo** system.
    *   **Pan & Zoom** navigation (Space to pan, Scroll to zoom).
    *   **Cropping** workflow with dimmer overlay.
    *   **Censor** tools (Blur/Mosaic) for privacy or creative effects.
    *   **Merge** functionality to flatten the current view into the front layer.
*   **Privacy First**: All processing happens locally in your browser. Your images are never uploaded to a server.
*   **High Performance**: Utilizes a "fast preview" system and offscreen canvases to ensure smooth interactions even at high resolutions.

## Getting Started

OkazuStudio is a static web application with no build steps or complex installation required.

1.  **Clone or Download** this repository.
2.  **Open** `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
3.  **Drag and Drop** images onto the canvas or use the "Load Img A" / "Load Img B" buttons to start editing.

## Architecture

The project is built with vanilla JavaScript and HTML5 Canvas, using Tailwind CSS for styling. It features a modular architecture:
*   `scripts/main.js`: Core application logic and wiring.
*   `scripts/input.js`: Handles user input (mouse, keyboard, touch) and brush mechanics.
*   `scripts/adjustments.js`: Manages image processing filters and LUTs.
*   `scripts/undo.js`: Manages the history stack for non-destructive editing.
*   `scripts/settings.js`: Handles user preferences and persistence.

---
<sub>Produced by Google Jules with Gemini 3.0</sub>
