# OkazuStudio

OkazuStudio is a specialized, client-side web application designed to streamline the workflow of combining and polishing image variants. It removes the friction of heavy image editors, allowing you to rapidly resolve differences between versions of an artwork—such as swapping facial expressions, mixing outfit elements, or adjusting watermark placement—without the overhead of setting up layers and project files.

## Use Cases

*   **Variant Merging**: Instantly load two versions of an image (e.g., "Smile" vs. "Frown") and paint the preferred details from one onto the other using a fast, intuitive masking system.
*   **Rapid Censoring**: The masking workflow is optimized for privacy edits; simply "poke holes" in the image to reveal a blurred or mosaicked version of itself below. This setup is automatic, saving time compared to manual filter layers.
*   **Finishing Touches**: Because compositing often requires matching tones or final polish, a full suite of color balance, levels, and exposure tools is built right in. Tweak your final output without leaving the browser.

## Features

*   **Dual-Image Compositing**: Drag-and-drop workflow to blend two source images (Slots A and B).
*   **Advanced Masking**:
    *   **Erase & Repair**: Paint with additive or subtractive brushes to reveal or hide layers.
    *   **Precision Control**: Adjustable brush size, hardness, and Polyline drawing (Ctrl + Click).
*   **Integrated Adjustments**: comprehensive tools to unify your composite:
    *   **Exposure**: Gamma, Shadows, Highlights.
    *   **Levels**: Black point, Mid point, White point.
    *   **Color**: Saturation, Vibrance, White Balance.
    *   **Channels**: Fine-tune Cyan/Red, Magenta/Green, and Yellow/Blue balance.
*   **Productivity Tools**:
    *   **History**: Robust Undo/Redo stack.
    *   **Navigation**: Smooth Pan (Space + Drag) and Zoom (Scroll).
    *   **Overlay**: Crop tool with dimmer overlay.
    *   **Merge**: Flatten the current view into the front layer to continue editing.
*   **Privacy First**: Zero data upload. All processing occurs locally in your browser using HTML5 Canvas.

## Getting Started

OkazuStudio is a static web application with no build steps or complex installation required.

1.  **Clone or Download** this repository.
2.  **Open** `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
3.  **Drag and Drop** your base image and variant onto the canvas to begin.

## Architecture

The project is built with vanilla JavaScript and HTML5 Canvas, using Tailwind CSS for styling. It features a modular architecture:
*   `scripts/main.js`: Core application logic and wiring.
*   `scripts/input.js`: Handles user input (mouse, keyboard, touch) and brush mechanics.
*   `scripts/adjustments.js`: Manages image processing filters and LUTs.
*   `scripts/undo.js`: Manages the history stack for non-destructive editing.
*   `scripts/settings.js`: Handles user preferences and persistence.

---
<sub>Produced by Google Jules with Gemini 3.0</sub>
