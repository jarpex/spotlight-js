# Spotlight JS

Spotlight JS is a tiny, dependency-free image viewer that instantly turns images on any webpage into a polished full-screen gallery. It provides smooth animations, trackpad gestures, touch, keyboard shortcuts and fullscreen support — all wired up automatically with zero configuration.

[Try the live demo](https://dev.jarpex.ru/spotlight-js/)

## Why Spotlight

- Lightweight and self-contained — drop in `spotlight.min.js` and it just works.
- Automatic grouping — images inside `<article>` or elements with the `.gallery` class become collections.
- Fast, fluid animations — hardware-accelerated transitions for a native feel.
- Accessible — ARIA live region and sensible focus management.

## Features

- Automatic detection of images inside `article` and `.gallery`
- Fullscreen viewer with smooth transitions
- Zoom (buttons, mouse wheel, trackpad, pinch)
- Pan by dragging
- Trackpad gestures (including natural/inverted scrolling calibration)
- Touch support with swipe-to-close
- Keyboard navigation (Arrow keys + optional VIM-like keys)
- Captions from `figcaption`, `alt`, or `data-caption`
- Dark / light theme support via `prefers-color-scheme`
- Security guards for data URIs and protocol validation
- Programmatic API for manual control and dynamic content
- No external dependencies

## Controls

Experience full control via keyboard, mouse, touch, and trackpad.

| Control                                                                                                                                                                     |                                                                      Example                                                                      |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------: |
| **Previous Image**<br>- **Keyboard:** `ArrowLeft` / `H`<br>- **Mouse:** Left arrow button / Scroll Up<br>- **Touch:** Swipe Right<br>- **Trackpad:** Two fingers swipe left |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-left.gif" alt="Swipe left" width="250" />  |
| **Next Image**<br>- **Keyboard:** `ArrowRight` / `L`<br>- **Mouse:** Right arrow button / Scroll Down<br>- **Touch:** Swipe Left<br>- **Trackpad:** Two fingers swipe right | <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-right.gif" alt="Swipe right" width="250" /> |
| **Zoom In**<br>- **Keyboard:** `+` / `=`<br>- **Mouse:** Zoom in button / `Ctrl` + Scroll Up<br>- **Touch:** Pinch Out<br>- **Trackpad:** Pinch/zoom gesture                |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-zoom-in.gif" alt="Pinch zoom in" width="250" />  |
| **Zoom Out**<br>- **Keyboard:** `-` / `_`<br>- **Mouse:** Zoom out button / `Ctrl` + Scroll Down<br>- **Touch:** Pinch In<br>- **Trackpad:** Pinch/zoom gesture             | <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-zoom-out.gif" alt="Pinch zoom out" width="250" /> |
| **Reset Zoom / 100%**<br>- **Keyboard:** `0`<br>- **Mouse:** Zoom percentage button                                                                                         |                                                                   (No gesture)                                                                    |
| **Toggle Fullscreen**<br>- **Keyboard:** `F`<br>- **Mouse:** Fullscreen button                                                                                              |                                                                   (No gesture)                                                                    |
| **Close Spotlight**<br>- **Keyboard:** `Escape`<br>- **Mouse:** Close (cross) button / Click outside<br>- **Touch:** Swipe Down<br>- **Trackpad:** Two fingers swipe down   |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-down.gif" alt="Swipe down" width="250" />  |

## Configuration

Spotlight can be configured via the `Spotlight.config` object. Note that configuration should be set before initialization or a `rescan()`.

```js
Spotlight.config = {
  // CSP nonce for inline styles
  cspNonce: 'your-nonce-here',
  // Allow opening local file:// and blob: URLs (disabled by default for security)
  allowLocalFiles: false,
  // Limit for data:image URLs to prevent DoS (default: 2MB)
  maxDataUrlLength: 2000000,
  // Allowed MIME types for data:image URLs
  allowedDataImageMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
  ],
  // Telemetry hook for non-fatal errors
  onError: (err) => console.error('Spotlight error:', err),
  // Root elements to scan for images (default: 'article, .gallery')
  autoInitRootSelector: 'article, .gallery',
};
```

## Installation

Include the built script on your page:

```html
<script src="spotlight.min.js"></script>
```

Spotlight initializes automatically when a user clicks an image inside an `article` or a `.gallery` element.

## Usage

Write normal HTML — Spotlight works with simple images or semantic markup:

```html
<article>
  <figure>
    <img src="photo1.jpg" alt="Mountains at sunrise" />
    <figcaption>Mountains at sunrise</figcaption>
  </figure>

  <img src="photo2.jpg" alt="Forest trail" />
</article>
```

Or use a gallery:

```html
<div class="gallery">
  <img src="a.jpg" />
  <img src="b.jpg" />
  <img src="c.jpg" />
</div>
```

Click any image to open the viewer.

## Development

To contribute or build Spotlight from source:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/jarpex/spotlight-js.git
   cd spotlight-js
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   Spotlight offers two build modes:
   - **Optimized Build (Default):**

     ```bash
     npm run build
     ```

     Creates a highly compressed bundle in `dist/spotlight.min.js`. This mode aggressively renames CSS classes and IDs to short tokens (e.g., `a`, `b`) to minimize size.
     _Warning: This may cause conflicts if your page uses similar short class names or IDs._

   - **Safe Build:**

     ```bash
     npm run build:safe
     ```

     Creates a standard minified bundle that preserves original class names and IDs. Use this version to avoid conflicts with other scripts or styles on your page, or if you need to use the Programmatic API.

   - **Disable auto-init (optional):**

     By default the distributed build includes automatic initialization (click-to-open behavior).

     To create a bundle that does NOT auto-initialize, use the provided npm helper scripts (recommended):

     ```bash
     npm run build:no-auto-init
     npm run build:safe:no-auto-init
     ```

     These scripts set the build-time flag that removes the global auto-init block from the generated bundle so consumers can opt-in to `Spotlight.initAuto()` programmatically. (Directly passing unknown CLI flags to `vite` may be rejected by the Vite CLI.)

## Programmatic API

> **Note:** The programmatic API is available only in the **safe build**.
>
> The standard `npm run build` command uses aggressive minification that renames classes and symbols, making the API inaccessible. To use the API, build the project with `npm run build:safe`.

### Static Methods

- `Spotlight.init()` — Re-attaches auto-initialization click handlers.
- `Spotlight.uninit()` — Removes auto-initialization click handlers.
- `Spotlight.open(collectionIndex, itemIndex)` — Opens the gallery. Defaults to the first image in the first collection if no indices are provided.
- `Spotlight.rescan()` — Re-scans the DOM for new images. Call this after dynamically adding content to the page.
- `Spotlight.getCapturedErrors()` — Retrieves a list of non-fatal errors logged by the library.
- `Spotlight.clearCapturedErrors()` — Clears the list of captured errors.

### Properties

- `Spotlight.instance` — Returns the active Spotlight instance, or `null` if the gallery has not been initialized.
- `Spotlight.debug` — Enables verbose console logging when set to `true`. Only functional in development builds.

### Instance Methods

Access the instance via `Spotlight.instance`.

- `instance.attachImage(element, collectionIndex, itemIndex)` — Manually registers an image element with the Spotlight gallery.

### Example

```js
// Enable debug mode
Spotlight.debug = true;

// Open the first image in the first collection
Spotlight.open(0, 0);

// Manually attach an image
const instance = Spotlight.instance;
if (instance) {
  const img = document.querySelector('#my-image');
  instance.attachImage(img, 0, 0);
}
```

## Security

To prevent tracking via SVG external resources, we recommend setting a CSP header: `img-src 'self' data: [your-trusted-cdn];`. Spotlight also supports `cspNonce` in its configuration for strict `style-src` policies.

## License

Spotlight JS is released under the MIT License — see `LICENSE`. It bundles Tabler Icons (MIT) as noted in `LICENSE.tabler-icons`.
