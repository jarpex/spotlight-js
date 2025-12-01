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
- Trackpad gestures
- Touch support
- Keyboard navigation (Arrow keys + optional VIM-like keys)
- Captions from `figcaption`, `alt`, or `data-caption`
- Dark / light theme support via `prefers-color-scheme`
- No external dependencies

## Controls

Experience full control via keyboard, mouse, touch, and trackpad.

| Control                                                                                                                                                         |                                                                      Example                                                                      |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------: |
| **Previous Image**<br>- **Keyboard:** `ArrowLeft` / `H`<br>- **Mouse:** Left arrow button<br>- **Touch:** Swipe Right<br>- **Trackpad:** Two fingers swipe left |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-left.gif" alt="Swipe left" width="250" />  |
| **Next Image**<br>- **Keyboard:** `ArrowRight` / `L`<br>- **Mouse:** Right arrow button<br>- **Touch:** Swipe Left<br>- **Trackpad:** Two fingers swipe right   | <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-right.gif" alt="Swipe right" width="250" /> |
| **Zoom In**<br>- **Keyboard:** `+` / `=`<br>- **Mouse:** Zoom in button / `Ctrl` + Scroll Up<br>- **Touch:** Pinch Out<br>- **Trackpad:** Pinch/zoom gesture    |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-zoom-in.gif" alt="Pinch zoom in" width="250" />  |
| **Zoom Out**<br>- **Keyboard:** `-` / `_`<br>- **Mouse:** Zoom out button / `Ctrl` + Scroll Down<br>- **Touch:** Pinch In<br>- **Trackpad:** Pinch/zoom gesture | <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-zoom-out.gif" alt="Pinch zoom out" width="250" /> |
| **Toggle Fullscreen**<br>- **Keyboard:** `F`<br>- **Mouse:** Fullscreen button                                                                                  |                                                                   (No gesture)                                                                    |
| **Close Spotlight**<br>- **Keyboard:** `Escape`<br>- **Mouse:** Close (cross) button<br>- **Touch:** Swipe Down<br>- **Trackpad:** Two fingers swipe down       |  <img src="https://raw.githubusercontent.com/jarpex/spotlight-js/refs/heads/main/assets/touchpad-swipe-down.gif" alt="Swipe down" width="250" />  |

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

## Programmatic API

```js
// Open collection 0, item 0
Spotlight.open(0, 0);

// Re-scan the page after dynamically adding images
Spotlight.rescan();

// Get current instance
const inst = Spotlight.instance;
```

## License

Spotlight JS is released under the MIT License — see `LICENSE`. It bundles Tabler Icons (MIT) as noted in `LICENSE.tabler-icons`.
