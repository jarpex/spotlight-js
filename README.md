# Spotlight JS

Spotlight JS is a lightweight, self-contained image viewer that automatically transforms images on any webpage into a modern full-screen gallery with zoom, pan, swipe navigation, pinch-to-zoom, keyboard shortcuts, and fullscreen support.

It scans `article` elements and elements with the `gallery` class, builds image collections automatically, and opens them in a smooth, high-performance overlay. No setup, no markup changes — just include the script and it works.

[Try the live demo](https://dev.jarpex.ru/spotlight-js/)

## Features

- Automatic detection of images inside `article` and `.gallery`
- Fullscreen viewer with smooth animations
- Zoom (buttons, mouse wheel, trackpad, pinch)
- Pan by dragging
- Swipe and trackpad navigation
- Keyboard navigation (VIM-bindings, arrows, zoom keys, `F` for fullscreen) for any keyboard layout
- Captions from `figcaption`, `alt`, or `data-caption`
- Accessible (ARIA live region, focus management)
- Dark and light theme support (via `prefers-color-scheme`)
- Fully self-contained (injects styles, overlay, controls)

## Installation

Simply include the script in your HTML:

```html
<script src="spotlight.min.js"></script>
```

The script initializes automatically when a user clicks any image inside an `article` or an element with the `gallery` class.

## Usage

### Basic usage

Write your HTML normally:

```html
<article>
  <figure>
    <img src="photo1.jpg" alt="Mountains at sunrise" />
    <figcaption>Mountains at sunrise</figcaption>
  </figure>

  <figure>
    <img src="photo2.jpg" alt="Forest trail" />
  </figure>
</article>
```

or simpler:

```html
<article>
  <img src="photo1.jpg" />
  <img src="photo2.jpg" />
</article>
```

or using galleries:

```html
<div class="gallery">
  <img src="a.jpg" />
  <img src="b.jpg" />
  <img src="c.jpg" />
</div>
```

Clicking any image opens the Spotlight viewer.

### Programmatic API

```js
// Open the first collection, item 0
Spotlight.open(0, 0);
```

```js
// Re-scan the page after dynamically adding images
Spotlight.rescan();
```

```js
// Get current instance
const inst = Spotlight.instance;
```

## Keyboard Controls

- `ArrowRight` / `L` — next image
- `ArrowLeft` / `H` — previous image
- `0` — reset zoom
- `+` / `=` — zoom in
- `-` / `_` — zoom out
- `F` — toggle fullscreen
- `Escape` — close viewer

## License

Spotlight JS is licensed under the MIT License (see `LICENSE`). It includes Tabler Icons, which are also distributed under the MIT License (see `LICENSE.tabler-icons`).
