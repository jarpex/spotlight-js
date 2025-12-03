/*!
 * Spotlight JS v1.0.1
 * Copyright (c) 2025 Anastasia Shebalkina
 * Licensed under the MIT License (see LICENSE)
 *
 * Includes Tabler Icons (https://tabler.io/icons), MIT License
 * Copyright (c) 2020-2025 Tabler Icons Authors (see LICENSE.tabler-icons)
 */

(() => {
  'use strict';

  // Constants

  // Event Handling
  const EVENT_PREFIX_LENGTH = 2; // Length of 'on' prefix for event handlers

  // ID Generation
  const ID_BASE = 36; // Base for random ID generation
  const ID_SLICE_START = 2; // Start index for random ID slicing
  const ID_SLICE_END = 9; // End index for random ID slicing

  // Zoom & Scale
  const ZOOM_FACTOR = 1.2; // Factor to zoom in/out by
  const MAX_SCALE = 8; // Maximum zoom scale
  const MIN_SCALE = 0.2; // Minimum zoom scale
  const MIN_SCALE_FIT = 0.05; // Minimum scale when fitting to viewport
  const PERCENTAGE = 100; // Multiplier for percentage display
  const CENTER_OFFSET = 0.5; // Center offset for zoom calculation (0.5 = center)

  // Pinch Gesture
  const POINTERS_COUNT = 2; // Number of pointers for pinch gesture
  const PINCH_MODERATION = 1; // Moderation factor for pinch zoom sensitivity
  const PINCH_SENSITIVITY_TOUCH = 1.1; // Sensitivity for touch devices

  // Pan & Swipe (Touch)
  const PAN_THRESHOLD = 0.1; // Threshold for panning vs zooming on touch
  const SWIPE_TIMEOUT = 500; // Max time for a swipe gesture (ms)
  const SWIPE_SCALE_THRESHOLD = 0.25; // Max scale deviation to allow swipe navigation
  const SWIPE_THRESHOLD_PX = 20; // Minimum pixel distance for a swipe
  const SWIPE_DOWN_THRESHOLD = 100; // Pixels to drag down to close
  const SWIPE_CLOSE_DIVISOR = 150; // Divisor for swipe-to-close animation progress

  // Wheel Interaction
  const WHEEL_SCALE_THRESHOLD_NEAR = 0.8; // Threshold for "near base scale" check
  const WHEEL_SCALE_THRESHOLD_FACTOR = 0.5; // Factor of base scale for threshold
  const SWIPE_DEBOUNCE = 500; // Debounce time for rapid swipes (ms)
  const WHEEL_RATIO_THRESHOLD = 0.65; // Ratio of X to Y delta for horizontal swipe detection
  const WHEEL_Y_THRESHOLD = 10; // Max Y delta for horizontal swipe detection
  const WHEEL_RESET_DELAY = 80; // Delay to reset wheel gesture state (ms)
  const MOUSE_WHEEL_NAV_DEBOUNCE = 300; // Debounce time for mouse wheel navigation (ms)
  const MOUSE_WHEEL_NAV_THRESHOLD = 2; // Minimum deltaY to trigger mouse wheel navigation
  const WHEEL_ACCELERATION_THRESHOLD = 5; // Threshold for wheel acceleration detection
  const UNLOCK_WHEEL_GAP = 150; // Time gap to unlock wheel mode

  // Input & Calibration
  const INPUT_DETECTION_DELAY = 400; // Delay for input detection (ms)
  const CALIBRATION_COOLDOWN = 800; // Cooldown after calibration (ms)
  const CALIBRATION_CLOSE_DELAY = 300; // Delay to close calibration (ms)

  // Animation & UI
  const SLIDE_OFFSET = 60; // Pixel offset for slide animation
  const CLOSE_DELAY = 220; // Delay before removing overlay from DOM after close (ms)
  const CONVERGENCE_SCALE = 0.001; // Convergence threshold for scale animation
  const CONVERGENCE_TRANSLATE = 0.1; // Convergence threshold for translate animation
  const CURSOR_SCALE_THRESHOLD = 0.02; // Threshold for changing cursor to grab

  const LS_KEY_NATURAL = 'spotlight-natural-scrolling';

  // Utility
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const create = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style') {
        Object.assign(el.style, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(EVENT_PREFIX_LENGTH), v);
      } else if (k === 'dataset') {
        Object.entries(v).forEach(([dk, dv]) => (el.dataset[dk] = dv));
      } else {
        el.setAttribute(k, v);
      }
    });
    children.forEach((c) =>
      typeof c === 'string'
        ? el.appendChild(document.createTextNode(c))
        : el.appendChild(c)
    );
    return el;
  };

  // SVG icons used for the fullscreen toggle
  const SVG_MAXIMIZE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrows-maximize"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 4l4 0l0 4" /><path d="M14 10l6 -6" /><path d="M8 20l-4 0l0 -4" /><path d="M4 20l6 -6" /><path d="M16 20l4 0l0 -4" /><path d="M14 14l6 6" /><path d="M8 4l-4 0l0 4" /><path d="M4 4l6 6" /></svg>
  `;

  const SVG_MINIMIZE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrows-minimize"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 9l4 0l0 -4" /><path d="M3 3l6 6" /><path d="M5 15l4 0l0 4" /><path d="M3 21l6 -6" /><path d="M19 9l-4 0l0 -4" /><path d="M15 9l6 -6" /><path d="M19 15l-4 0l0 4" /><path d="M15 15l6 6" /></svg>
  `;

  // Main
  class Spotlight {
    constructor() {
      this.collections = []; // {id, container, items: [{src, el}], title?}
      this.overlay = null;
      this.state = {
        open: false,
        collectionIndex: 0,
        itemIndex: 0,
        scale: 1,
        baseScale: 1,
        translateX: 0,
        translateY: 0,
        fullscreen: false,
      };
      this._rafId = null;
      this._renderActive = false;
      this.renderState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
      };
      this._uiHideTimer = null;
      this._uiHideDelay = 1500;
      this._wheelSwipeAccum = 0;
      this._wheelSwipeTimer = null;
      this._wheelMode = null; // 'swipe' | 'zoom'
      this._lastSwipeNavTime = 0; // Timestamp of last horizontal swipe navigation
      this._lastWheelEventTime = 0; // Timestamp of last wheel event (for inertia detection)
      this._lastWheelDeltaX = 0; // Magnitude of last wheel delta X (for acceleration detection)
      this._lastMouseWheelNav = 0; // Timestamp of last mouse wheel navigation
      this._swipeModeLocked = false; // True during debounce after navigation
      this._trackpadSwipeToClose = false; // Flag for trackpad swipe to close gesture
      this._pendingSlideDir = 0;
      this.touchStart = null;
      this._dragPointerId = null;
      this._dragLast = { x: 0, y: 0 };
      this._isPinching = false;
      this.pointers = new Map();
      this._caughtErrors = [];
      // Debug mode: allow console output for debugging if enabled
      this.debug = Boolean(window && window.__spotlight_debug__);

      // Input modality detection
      this._lastTouchTime = 0;
      this._wheelSource = null;
      this._hasTrackpad =
        document.body?.classList.contains('using-trackpad') || false;

      // Trackpad Inversion
      try {
        const storedNatural = window.localStorage.getItem(LS_KEY_NATURAL);
        this.invertedScroll = storedNatural === 'true';
        this.needsCalibration = storedNatural === null;
      } catch (err) {
        this._reportError('localStorage.getItem', err);
        this.invertedScroll = false;
        this.needsCalibration = true;
      }
      this.calibrationActive = false;
      this.calibrationSource = null;
      this._pendingCalibrationListener = null;

      this._init();
    }

    _reportError(op, err) {
      try {
        this._caughtErrors.push({ op, err, time: Date.now() });
      } catch {
        // If the array is not writable for some reason, fall back to noop
      }
      if (
        this.debug &&
        typeof globalThis !== 'undefined' &&
        globalThis.console &&
        globalThis.console.warn
      ) {
        globalThis.console.warn(`[Spotlight] ${op}:`, err);
      }
    }

    _getCapturedErrors() {
      return Array.from(this._caughtErrors || []);
    }

    _clearCapturedErrors() {
      this._caughtErrors = [];
    }

    _init() {
      this._detectInputMethod();
      this._injectStyles();
      this._scanCollections();
      this._createOverlay();

      this.liveRegion = create('div', {
        'aria-live': 'polite',
        style: {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: '0',
        },
      });
      this.nodes.shell.appendChild(this.liveRegion);

      this._bindGlobalListeners();
    }

    _detectInputMethod() {
      window.addEventListener(
        'touchstart',
        () => {
          this._lastTouchTime = window.performance.now();
          this._setInputMode('touch');
        },
        { passive: true }
      );
    }

    _determineWheelSource(event) {
      if (!event) {
        return this._wheelSource || 'mouse';
      }

      // Guard against synthetic events fired while touching the screen.
      const now = window.performance.now();
      if (now - (this._lastTouchTime || 0) < INPUT_DETECTION_DELAY) {
        return this._wheelSource || 'mouse';
      }

      // If we already detected trackpad, keep using it (sticky)
      // This prevents re-detection delays during gesture pauses
      if (this._wheelSource === 'trackpad') {
        return 'trackpad';
      }

      const isTrackpad = this._isTrackpadWheel(event);
      const source = isTrackpad ? 'trackpad' : 'mouse';

      if (isTrackpad) {
        this._hasTrackpad = true;
      }

      if (source !== this._wheelSource) {
        this._setInputMode(isTrackpad ? 'trackpad' : 'mouse');
      }

      this._wheelSource = source;

      return source;
    }

    _setInputMode(mode) {
      const body = document.body;
      if (!body) {
        return;
      }
      body.classList.remove('using-touch', 'using-mouse', 'using-trackpad');
      if (mode === 'touch') {
        body.classList.add('using-touch');
      } else if (mode === 'trackpad') {
        body.classList.add('using-trackpad');
        this._hasTrackpad = true;
      } else {
        body.classList.add('using-mouse');
      }
    }

    _isTrackpadWheel(event) {
      if (!event) {
        return false;
      }

      // Non-pixel wheel modes originate from mice/keyboard fallback.
      const DOM_DELTA_PIXEL = 0;
      if (
        typeof event.deltaMode === 'number' &&
        event.deltaMode !== DOM_DELTA_PIXEL
      ) {
        return false;
      }

      const absY = Math.abs(event.deltaY);

      if (absY === 0) {
        return false;
      }

      // Mouse wheels produce non-integer values like 4.000244140625
      // Trackpads produce clean integers like 1, 2, 3, etc.
      const isYInteger = Number.isInteger(event.deltaY);

      // If deltaY has any fractional component, it's a mouse
      if (!isYInteger) {
        return false;
      }

      // Trackpad: clean integer values
      // During fast swipes, trackpad can produce values up to ~10-15
      // but they're always integers
      return true;
    }

    _checkCalibration() {
      if (!this.needsCalibration || this.calibrationActive) {
        return;
      }

      const trigger = () => {
        this._showCalibration('trackpad');
      };

      if (
        this._hasTrackpad ||
        document.body.classList.contains('using-trackpad')
      ) {
        trigger();
        return;
      }

      const waitForTrackpad = (e) => {
        const source = this._determineWheelSource(e);
        if (source !== 'trackpad') {
          return;
        }
        window.removeEventListener('wheel', waitForTrackpad);
        this._pendingCalibrationListener = null;
        trigger();
      };

      window.addEventListener('wheel', waitForTrackpad, { passive: true });
      this._pendingCalibrationListener = waitForTrackpad;
    }

    _showCalibration(source = 'trackpad') {
      if (source !== 'trackpad' || this.calibrationActive) {
        return;
      }

      if (this._pendingCalibrationListener) {
        window.removeEventListener('wheel', this._pendingCalibrationListener);
        this._pendingCalibrationListener = null;
      }

      this.calibrationSource = source;
      this.calibrationActive = true;
      this.calibrationAccum = 0;
      this.calibrationStep = 0;
      this.calibrationStartTime = Date.now();

      const cal = create('div', {
        class: 'spot-calibration',
        role: 'dialog',
        'aria-labelledby': 'spot-calibration-title',
        'aria-describedby': 'spot-calibration-text',
      });
      const content = create('div', { class: 'spot-calibration-content' });

      const title = create('h3', { id: 'spot-calibration-title' }, [
        'Trackpad Setup',
      ]);
      const text = create('p', { id: 'spot-calibration-text' }, [
        'Swipe down repeatedly to calibrate.',
      ]);

      const animContainer = create('div', { class: 'trackpad-container' });
      animContainer.innerHTML = `
        <div class="trackpad">
            <div class="finger swipe-down" style="margin-left: -22px;"></div>
            <div class="finger swipe-down" style="margin-left: 22px;"></div>
        </div>
      `;

      const progressBar = create('div', { class: 'spot-progress-bar' });
      const progressValue = create('div', {
        class: 'spot-progress-value',
        'aria-live': 'polite',
      });
      progressBar.appendChild(progressValue);

      content.appendChild(title);
      content.appendChild(text);
      content.appendChild(animContainer);
      content.appendChild(progressBar);
      cal.appendChild(content);

      this.nodes.shell.appendChild(cal);
      this.nodes.calibration = cal;
      this.nodes.calibrationProgress = progressValue;
      this.nodes.calibrationText = text;

      // Fade in
      requestAnimationFrame(() => {
        cal.classList.add('visible');
      });
    }

    _handleCalibrationWheel(e) {
      if (this.calibrationSource !== 'trackpad') {
        return;
      }

      // Re-verify this is a trackpad event, not mouse
      if (!this._isTrackpadWheel(e)) {
        return;
      }

      // Startup delay - ignore input for INPUT_DETECTION_DELAY after calibration appears
      if (this._isCalibrationStartupDelayActive()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Ignore horizontal swipes for the actual calibration measurement
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return;
      }

      // Accumulate deltaY
      this.calibrationAccum = (this.calibrationAccum || 0) + e.deltaY;

      const TARGET = 80;
      const progress = Math.min(Math.abs(this.calibrationAccum) / TARGET, 1);

      this._setCalibrationProgress(progress);
    }

    _isCalibrationStartupDelayActive() {
      return (
        this.calibrationStartTime &&
        Date.now() - this.calibrationStartTime < INPUT_DETECTION_DELAY
      );
    }

    _setCalibrationProgress(progress) {
      if (this.nodes.calibrationProgress) {
        this.nodes.calibrationProgress.style.width = `${progress * PERCENTAGE}%`;
      }

      if (progress < 1) {
        return;
      }

      // Step 1 complete?
      if (this.calibrationStep === 0) {
        this.calibrationStep = 1;
        this.calibrationAccum = 0;
        this.calibrationStartTime = Date.now(); // Reset delay for step 2
        if (this.nodes.calibrationProgress) {
          this.nodes.calibrationProgress.style.width = '0%';
        }
        if (this.nodes.calibrationText) {
          this.nodes.calibrationText.textContent = 'One more time...';
        }
        return;
      }

      // Finished
      const isNatural = this.calibrationAccum < 0;
      this.invertedScroll = isNatural;
      try {
        window.localStorage.setItem(LS_KEY_NATURAL, String(isNatural));
      } catch (err) {
        this._reportError('localStorage.setItem', err);
      }
      this.needsCalibration = false;

      // Set cooldown to prevent immediate gesture triggering (e.g. swipe-to-close)
      this.calibrationCooldown = Date.now() + CALIBRATION_COOLDOWN;

      // Close calibration
      this.nodes.calibration.classList.remove('visible');
      setTimeout(() => {
        if (this.nodes.calibration) {
          this.nodes.calibration.remove();
          this.nodes.calibration = null;
          this.nodes.calibrationProgress = null;
          this.nodes.calibrationText = null;
        }
        this.calibrationActive = false;
        this.calibrationSource = null;
      }, CALIBRATION_CLOSE_DELAY);
    }

    // Scan <article> and .gallery for images
    _scanCollections() {
      this.collections = [];
      const map = new Map(); // container -> items[]

      // Find all images that are inside an article or .gallery
      const images = $$('img');

      images.forEach((img) => {
        const container = img.closest('article, .gallery');
        if (!container) {
          return;
        }

        if (!map.has(container)) {
          map.set(container, []);
        }

        // Try to get canonical src:
        const src =
          img.dataset.src || img.getAttribute('src') || img.currentSrc || null;
        if (!src) {
          return;
        }
        const figure = img.closest('figure');
        const captionEl = figure ? figure.querySelector('figcaption') : null;
        const captionText = captionEl
          ? captionEl.textContent.trim()
          : (
              img.getAttribute('data-caption') ||
              img.getAttribute('alt') ||
              ''
            ).trim();

        map.get(container).push({ src, el: img, caption: captionText });
      });

      // Create collections
      map.forEach((items, container) => {
        if (!items.length) {
          return;
        }
        const collectionIndex = this.collections.length;
        this.collections.push({
          id: `spot-${this._randId()}`,
          container,
          items,
        });

        // Update image datasets
        items.forEach((item, idx) => {
          item.el.dataset.spotlightCollection = String(collectionIndex);
          item.el.dataset.spotlightIndex = String(idx);
          item.el.style.cursor = 'zoom-in';
        });
      });
    }

    _randId() {
      return Math.random()
        .toString(ID_BASE)
        .slice(ID_SLICE_START, ID_SLICE_END);
    }

    // Overlay DOM + controls
    _createOverlay() {
      // Root overlay
      const overlay = create('div', {
        id: 'spot-overlay',
        'aria-hidden': 'true',
        tabindex: '-1',
      });

      const bg = create('div', { id: 'spot-bg' });
      const shell = create('div', {
        id: 'spot-shell',
        role: 'dialog',
        'aria-modal': 'true',
      });
      const stage = create('div', { id: 'spot-stage', class: 'spot-stage' });

      const prevBtn = create('button', {
        id: 'spot-prev',
        class: 'spot-nav',
        'aria-label': 'Previous image',
        'data-dir': '-1',
      });
      prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-compact-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M13 20l-3 -8l3 -8" /></svg>`;

      const canvas = create('div', { id: 'spot-canvas', class: 'spot-canvas' });
      const transform = create('div', {
        id: 'spot-transform',
        class: 'spot-transform',
      });
      const img = create('img', { id: 'spot-img', draggable: 'false' });

      transform.appendChild(img);
      canvas.appendChild(transform);

      const nextBtn = create('button', {
        id: 'spot-next',
        class: 'spot-nav',
        'aria-label': 'Next image',
        'data-dir': '1',
      });
      nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-compact-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M11 4l3 8l-3 8" /></svg>`;

      stage.appendChild(prevBtn);
      stage.appendChild(canvas);
      stage.appendChild(nextBtn);

      const ui = create('div', {
        id: 'spot-ui',
        class: 'spot-ui spot-ui-visible',
      });
      const topbar = create('div', { id: 'spot-topbar', class: 'spot-topbar' });
      const counter = create('div', {
        id: 'spot-counter',
        class: 'spot-counter',
      });
      const controls = create('div', { class: 'spot-controls' });

      const zoomOut = create('button', {
        id: 'spot-zoom-out',
        class: 'spot-btn',
        'aria-label': 'Zoom out',
      });
      zoomOut.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-zoom-out"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M7 10l6 0" /><path d="M21 21l-6 -6" /></svg>`;

      const zoomDisplay = create(
        'button',
        {
          id: 'spot-zoom-display',
          class: 'spot-btn',
          'aria-label': 'Reset zoom',
        },
        ['100%']
      );

      const zoomIn = create('button', {
        id: 'spot-zoom-in',
        class: 'spot-btn',
        'aria-label': 'Zoom in',
      });
      zoomIn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-zoom-in"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M7 10l6 0" /><path d="M10 7l0 6" /><path d="M21 21l-6 -6" /></svg>`;

      const fullscreen = create('button', {
        id: 'spot-fullscreen',
        class: 'spot-btn',
        'aria-label': 'Toggle fullscreen',
      });

      const close = create('button', {
        id: 'spot-close',
        class: 'spot-btn',
        'aria-label': 'Close',
      });
      close.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>`;

      controls.appendChild(zoomOut);
      controls.appendChild(zoomDisplay);
      controls.appendChild(zoomIn);
      controls.appendChild(fullscreen);
      controls.appendChild(close);

      topbar.appendChild(counter);
      topbar.appendChild(controls);

      const caption = create('div', {
        id: 'spot-caption',
        class: 'spot-caption',
      });

      ui.appendChild(topbar);
      ui.appendChild(caption);

      shell.appendChild(stage);
      shell.appendChild(ui);

      overlay.appendChild(bg);
      overlay.appendChild(shell);

      document.body.appendChild(overlay);
      this.overlay = overlay;

      // cache nodes
      this.nodes = {
        overlay,
        bg,
        shell,
        ui,
        closeBtn: close,
        zoomIn,
        zoomOut,
        zoomDisplay,
        fullscreenBtn: fullscreen,
        prevBtn,
        nextBtn,
        canvas,
        transform,
        imgNode: img,
        counter,
        caption,
      };

      // track whether pointer is over UI (topbar / caption / buttons / navs)
      this._pointerOverUi = false;
      // counter to avoid flicker when moving between tracked elements
      this._pointerOverUiCount = 0;

      // Elements to track: nav buttons, caption, topbar and all .spot-btn
      // Note: do NOT track this.nodes.ui because it covers the whole screen and would prevent hiding
      const btns = Array.from(overlay.querySelectorAll('.spot-btn'));
      const trackEls = [
        this.nodes.prevBtn,
        this.nodes.nextBtn,
        this.nodes.caption,
        topbar,
        ...btns,
      ].filter(Boolean);

      const onEnter = () => {
        this._pointerOverUiCount = (this._pointerOverUiCount || 0) + 1;
        this._pointerOverUi = true;
        this._showUiImmediate();
      };
      const onLeave = () => {
        this._pointerOverUiCount = Math.max(
          0,
          (this._pointerOverUiCount || 0) - 1
        );
        if (this._pointerOverUiCount === 0) {
          this._pointerOverUi = false;
          this._scheduleUiHide();
        }
      };

      trackEls.forEach((el) => {
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
      });

      // Events
      this.nodes.closeBtn.addEventListener('click', () => this.close());
      this.nodes.bg.addEventListener('click', () => this.close());
      this.nodes.prevBtn.addEventListener('click', () => this.prev());
      this.nodes.nextBtn.addEventListener('click', () => this.next());
      this.nodes.zoomIn.addEventListener('click', () =>
        this._zoomBy(ZOOM_FACTOR)
      );
      this.nodes.zoomOut.addEventListener('click', () =>
        this._zoomBy(1 / ZOOM_FACTOR)
      );
      this.nodes.zoomDisplay.addEventListener('click', () => this._resetZoom());
      this.nodes.fullscreenBtn.addEventListener('click', () =>
        this._toggleFullscreen()
      );
      overlay.addEventListener('pointermove', () => this._handleUserActivity());
      overlay.addEventListener('pointerdown', () => this._handleUserActivity());
      overlay.addEventListener('touchstart', () => this._handleUserActivity(), {
        passive: true,
      });
      this._updateFullscreenButton();

      // Prevent scroll behind overlay
      overlay.addEventListener(
        'wheel',
        (e) => {
          if (this.state.open && this._isPointerOverStage(e)) {
            e.preventDefault();
          }
        },
        { passive: false }
      );
    }

    // check if event target is inside stage so we can handle wheel pan vs page scroll
    _isPointerOverStage(e) {
      const rect = this.nodes.canvas.getBoundingClientRect();
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    }

    _bindGlobalListeners() {
      // Keyboard
      window.addEventListener('keydown', (e) => this._handleKeydown(e));

      // Wheel to zoom (if pointer over image)
      this.nodes.canvas.addEventListener(
        'wheel',
        (e) => this._handleWheelEvent(e),
        {
          passive: false,
        }
      );
      // Also listen on overlay for calibration events if they bubble up or occur outside canvas
      this.nodes.overlay.addEventListener(
        'wheel',
        (e) => {
          if (this.calibrationActive) {
            this._handleCalibrationWheel(e);
          }
        },
        { passive: false }
      );

      // Drag image (pan)
      this.nodes.imgNode.addEventListener('pointerdown', (e) => {
        if (!this.state.open) {
          return;
        }
        this._handleUserActivity();
        if (!e.isPrimary) {
          return;
        }
        this._dragPointerId = e.pointerId;
        this._dragLast.x = e.clientX;
        this._dragLast.y = e.clientY;
        this._dragStart = { x: e.clientX, y: e.clientY };
        this._isVerticalSwipe = false;
        try {
          this.nodes.imgNode.setPointerCapture(e.pointerId);
        } catch (err) {
          this._reportError('setPointerCapture', err);
        }
      });
      window.addEventListener('pointermove', (e) => this._handlePointerMove(e));
      window.addEventListener('pointerup', (e) => {
        if (this._dragPointerId === e.pointerId) {
          if (this._isVerticalSwipe) {
            const totalDy = e.clientY - this._dragStart.y;
            if (totalDy > SWIPE_DOWN_THRESHOLD) {
              this.close();
            } else {
              this.state.translateY = 0;
              this._constrainAndSync();
              this._startRenderLoop();
            }
            this._isVerticalSwipe = false;
          }
          try {
            this.nodes.imgNode.releasePointerCapture(e.pointerId);
          } catch (err) {
            this._reportError('releasePointerCapture', err);
          }
          this._dragPointerId = null;
        }
      });

      // Touch swipes: detect horizontal swipe when at default zoom to navigate
      this.touchStart = null;
      this.nodes.canvas.addEventListener(
        'touchstart',
        (e) => {
          if (!this.state.open) {
            return;
          }
          this._handleUserActivity();
          if (e.touches.length === 1) {
            this.touchStart = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              t: Date.now(),
            };
          } else {
            this.touchStart = null;
          }
        },
        { passive: true }
      );
      this.nodes.canvas.addEventListener(
        'touchend',
        (e) => this._handleTouchEnd(e),
        { passive: true }
      );

      // Pinch-to-zoom using Pointer Events
      this._bindPinch();

      const ro = new ResizeObserver(() => {
        if (!this.state.open) {
          return;
        }
        this._fitImageToViewport();
        this._applyTransform({ immediate: true });
      });
      ro.observe(this.nodes.canvas);

      document.addEventListener('fullscreenchange', () =>
        this._syncFullscreenState()
      );

      // Safari Trackpad Gesture (Pinch)
      let gestureLastScale = 1;
      this.nodes.canvas.addEventListener(
        'gesturestart',
        (e) => {
          if (!this.state.open) {
            return;
          }
          e.preventDefault();
          if (this.pointers.size > 0) {
            return;
          }
          gestureLastScale = 1;
          this._isPinching = true;
        },
        { passive: false }
      );
      this.nodes.canvas.addEventListener(
        'gesturechange',
        (e) => {
          if (!this.state.open) {
            return;
          }
          e.preventDefault();
          if (this.pointers.size > 0) {
            return;
          }
          const delta = e.scale / gestureLastScale;
          gestureLastScale = e.scale;
          if (delta !== 1) {
            // Apply moderation to the delta
            const moderatedDelta = 1 + (delta - 1) * PINCH_MODERATION;
            this._zoomAtPoint(moderatedDelta, e.clientX, e.clientY);
          }
        },
        { passive: false }
      );
      this.nodes.canvas.addEventListener(
        'gestureend',
        () => {
          if (this.pointers.size > 0) {
            return;
          }
          this._isPinching = false;
        },
        { passive: false }
      );
    }

    _handleWheelEvent(e) {
      if (!this.state.open) {
        return;
      }

      const source = this._determineWheelSource(e);
      const isTrackpad = source === 'trackpad';

      if (this.calibrationActive) {
        if (isTrackpad) {
          this._handleCalibrationWheel(e);
        }
        return;
      }

      // Ignore events during cooldown (e.g. inertia after calibration)
      if (this.calibrationCooldown && Date.now() < this.calibrationCooldown) {
        return;
      }

      // Mouse wheel handling: ctrl+wheel = zoom, plain wheel = navigate images
      if (!isTrackpad) {
        e.preventDefault();
        this._handleUserActivity();
        if (e.ctrlKey) {
          // Ctrl+wheel = zoom
          this._handleWheelZoom(e, false);
        } else {
          // Plain mouse wheel = navigate images
          this._handleMouseWheelNavigation(e.deltaY);
        }
        return;
      }

      if (isTrackpad && this.needsCalibration && !this.calibrationActive) {
        e.preventDefault();
        this._showCalibration('trackpad');
        return;
      }

      this._handleTrackpadWheel(e);
    }

    _handleTrackpadWheel(e) {
      const now = Date.now();
      const timeSinceLastNav = now - (this._lastSwipeNavTime || 0);
      const timeSinceLastWheel = now - (this._lastWheelEventTime || 0);

      // If mode was locked after a swipe navigation, only reset when:
      // 1. Debounce period has passed (500ms since last nav), AND
      // 2. Either there's been a significant pause in wheel events (>150ms)
      //    OR we detect a new gesture start (acceleration in deltaX)
      // This prevents unlocking during continuous fast swiping with brief gaps,
      // but allows rapid intentional swipes.
      if (this._swipeModeLocked) {
        const absDeltaX = Math.abs(e.deltaX);
        // Check for significant acceleration (new swipe start)
        // We use a threshold of 5 to filter out noise/minor fluctuations in inertia
        const isAcceleration =
          absDeltaX >
          (this._lastWheelDeltaX || 0) + WHEEL_ACCELERATION_THRESHOLD;

        if (
          timeSinceLastNav >= SWIPE_DEBOUNCE &&
          (timeSinceLastWheel > UNLOCK_WHEEL_GAP || isAcceleration)
        ) {
          this._swipeModeLocked = false;
          this._wheelMode = null;
          this._wheelSwipeAccum = 0;
        }
      }
      this._lastWheelEventTime = now;
      this._lastWheelDeltaX = Math.abs(e.deltaX);

      this._handleUserActivity();
      const mode = this._detectWheelMode(e);
      e.preventDefault();
      if (mode === 'swipe') {
        this._handleSwipeWheel(e.deltaX);
      } else {
        this._handleWheelZoom(e, true);
      }
      this._scheduleWheelGestureReset();
    }

    _commitSwipeNavigation(direction) {
      const now = Date.now();
      this._lastSwipeNavTime = now;
      this._wheelSwipeAccum = 0;
      // Lock mode to 'zoom' to prevent inertia from re-triggering
      this._wheelMode = 'zoom';
      this._swipeModeLocked = true;
    }

    _handleSwipeWheel(deltaX) {
      const now = Date.now();
      const timeSinceLastNav = now - (this._lastSwipeNavTime || 0);

      // During debounce period, don't accumulate
      if (timeSinceLastNav < SWIPE_DEBOUNCE) {
        return;
      }

      let dx = deltaX;
      if (this.invertedScroll) {
        dx = -dx;
      }

      const threshold = 20; // tuned for macOS trackpads
      const base = this.state.baseScale || 1;
      if (
        Math.abs(this.state.scale - base) >
        Math.max(
          WHEEL_SCALE_THRESHOLD_NEAR,
          base * WHEEL_SCALE_THRESHOLD_FACTOR
        )
      ) {
        return;
      }

      this._wheelSwipeAccum += dx;
      if (this._wheelSwipeAccum > threshold) {
        this._commitSwipeNavigation(1);
        this.next();
      } else if (this._wheelSwipeAccum < -threshold) {
        this._commitSwipeNavigation(-1);
        this.prev();
      }
    }

    /**
     * Handle mouse wheel navigation (for non-trackpad users).
     * Scroll down = next image, scroll up = previous image.
     * Uses debouncing to prevent rapid navigation.
     */
    _handleMouseWheelNavigation(deltaY) {
      // Debounce rapid scrolls
      const now = Date.now();
      if (now - (this._lastMouseWheelNav || 0) < MOUSE_WHEEL_NAV_DEBOUNCE) {
        return;
      }

      // Threshold to filter out tiny movements
      if (Math.abs(deltaY) < MOUSE_WHEEL_NAV_THRESHOLD) {
        return;
      }

      this._lastMouseWheelNav = now;

      if (deltaY > 0) {
        this.next();
      } else {
        this.prev();
      }
    }

    _detectWheelMode(event) {
      if (this._wheelMode) {
        return this._wheelMode;
      }
      if (event.ctrlKey) {
        this._wheelMode = 'zoom';
        return this._wheelMode;
      }
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      const base = this.state.baseScale || 1;
      const nearBase =
        Math.abs(this.state.scale - base) <=
        Math.max(
          WHEEL_SCALE_THRESHOLD_NEAR,
          base * WHEEL_SCALE_THRESHOLD_FACTOR
        );

      // If both deltas are very small, don't lock mode yet
      if (absX < 1 && absY < 1) {
        return 'zoom'; // Default to zoom/vertical logic for now
      }

      const horizontal =
        (absX > absY * WHEEL_RATIO_THRESHOLD && absX - absY > 1) ||
        (absY < WHEEL_Y_THRESHOLD && absX > WHEEL_Y_THRESHOLD); // Only treat as horizontal if X is significant

      if (nearBase && horizontal) {
        this._wheelMode = 'swipe';
      } else if (absY > absX) {
        // Clearly vertical
        this._wheelMode = 'zoom';
      } else {
        // Ambiguous (e.g. absX > absY but diff is small)
        // Don't lock. Return 'zoom' to prevent default but keep listening.
        return 'zoom';
      }
      return this._wheelMode;
    }

    _handleWheelZoom(event, isTrackpad) {
      // If pinching via gesture, ignore wheel
      if (this._isPinching) {
        return;
      }

      // Trackpad pinch (ctrlKey)
      if (event.ctrlKey) {
        const delta = -event.deltaY;
        // Base sensitivity for trackpad pinch (pixels to scale)
        const TRACKPAD_BASE_SENSITIVITY = 0.01;
        const effectiveSensitivity =
          TRACKPAD_BASE_SENSITIVITY * PINCH_MODERATION;
        const factor = 1 + delta * effectiveSensitivity;
        this._zoomAtPoint(factor, event.clientX, event.clientY);
        return;
      }

      let deltaY = event.deltaY;
      if (isTrackpad && this.invertedScroll) {
        deltaY = -deltaY;
      }

      // Trackpad vertical swipe (pull down to close)
      // For trackpad, allow at any zoom level since pan is a different gesture (two-finger drag)
      // For touch screens, this is handled separately with zoom-level check
      if (isTrackpad) {
        // Only trigger if vertical movement is dominant and significant
        // This prevents accidental vertical swipes when trying to swipe horizontally
        if (Math.abs(deltaY) > Math.abs(event.deltaX) && Math.abs(deltaY) > 0) {
          this._isVerticalSwipe = true;
          this._swipeIntent = true;
          this._trackpadSwipeToClose = true; // Track that this is a trackpad-initiated close gesture
          // Use raw delta values - no multiplier for natural feel
          this.state.translateY += deltaY;
          // Prevent moving up (negative translateY) during swipe-to-close
          if (this.state.translateY < 0) {
            this.state.translateY = 0;
          }
          this._startRenderLoop();
        }
      }
    }

    _scheduleWheelGestureReset() {
      clearTimeout(this._wheelSwipeTimer);
      this._wheelSwipeTimer = setTimeout(
        () => this._endWheelGesture(),
        WHEEL_RESET_DELAY
      );
    }

    _endWheelGesture() {
      if (this._wheelSwipeTimer) {
        clearTimeout(this._wheelSwipeTimer);
        this._wheelSwipeTimer = null;
      }
      if (this._isVerticalSwipe) {
        if (this.state.translateY > SWIPE_DOWN_THRESHOLD) {
          this.close();
        } else {
          this.state.translateY = 0;
          this._constrainAndSync();
          this._startRenderLoop();
        }
        this._isVerticalSwipe = false;
        this._trackpadSwipeToClose = false;
      }
      this._wheelSwipeAccum = 0;
      // Don't reset wheelMode if we're in a swipe-locked state (protecting against inertia)
      // The wheel handler will reset it when debounce period ends
      if (!this._swipeModeLocked) {
        this._wheelMode = null;
      }
    }

    _handleUserActivity() {
      if (!this.state.open) {
        return;
      }
      this._showUiImmediate();
      this._scheduleUiHide();
    }

    _scheduleUiHide() {
      clearTimeout(this._uiHideTimer);
      this._uiHideTimer = setTimeout(() => {
        if (this._pointerOverUi) {
          // still over UI — reschedule hide
          this._scheduleUiHide();
        } else {
          this._hideUi();
        }
      }, this._uiHideDelay);
    }

    _showUiImmediate() {
      if (!this.nodes?.ui) {
        return;
      }
      this.nodes.ui.classList.add('spot-ui-visible');
      this.nodes.ui.classList.remove('spot-ui-hidden');
      // ensure navs are visible when UI is shown
      if (this.overlay) {
        this.overlay.classList.remove('spot-nav-hidden');
      }
    }

    _hideUi() {
      if (!this.nodes?.ui) {
        return;
      }
      this.nodes.ui.classList.add('spot-ui-hidden');
      this.nodes.ui.classList.remove('spot-ui-visible');
      // hide navs with outward animation
      if (this.overlay) {
        this.overlay.classList.add('spot-nav-hidden');
      }
    }

    _toggleFullscreen() {
      this._handleUserActivity();
      if (this.state.fullscreen) {
        this._exitFullscreen();
      } else {
        this._enterFullscreen();
      }
    }

    _enterFullscreen() {
      const target = this.overlay;
      if (!target || document.fullscreenElement === target) {
        return;
      }
      if (target.requestFullscreen) {
        const res = target.requestFullscreen();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
      this._syncFullscreenState();
    }

    _exitFullscreen() {
      if (document.fullscreenElement && document.exitFullscreen) {
        const res = document.exitFullscreen();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
      this._syncFullscreenState();
    }

    _syncFullscreenState() {
      const isFull = document.fullscreenElement === this.overlay;
      this.state.fullscreen = Boolean(isFull);
      this._updateFullscreenButton();
    }

    _updateFullscreenButton() {
      const btn = this.nodes?.fullscreenBtn;
      if (!btn) {
        return;
      }
      // Swap SVG icon depending on fullscreen state
      btn.innerHTML = this.state.fullscreen ? SVG_MINIMIZE : SVG_MAXIMIZE;
      btn.setAttribute(
        'aria-label',
        this.state.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
      );
      btn.setAttribute('aria-pressed', String(this.state.fullscreen));
    }

    _animateSlide(direction, cb) {
      this._handleUserActivity();
      this._pendingSlideDir = direction || 0;
      if (typeof cb === 'function') {
        cb();
      }
    }

    _playSlideIn(direction) {
      const img = this.nodes?.imgNode;
      if (!img) {
        return;
      }
      const dir = direction || 0;
      img.style.transition = 'none';
      if (dir) {
        img.style.transform = `translateX(${dir * SLIDE_OFFSET}px) scale(0.96)`;
        img.style.opacity = '0';
      } else {
        img.style.transform = 'translateX(0) scale(1)';
        img.style.opacity = '1';
      }
      requestAnimationFrame(() => {
        img.style.transition =
          'transform 650ms cubic-bezier(0.3, 1, 0.3, 1), opacity 400ms ease';
        img.style.transform = 'translateX(0) scale(1)';
        img.style.opacity = '1';
        const cleanup = () => {
          img.style.transition = '';
          img.style.transform = '';
          img.removeEventListener('transitionend', cleanup);
        };
        img.addEventListener('transitionend', cleanup, { once: true });
      });
    }

    _bindPinch() {
      let initialDistance = 0;
      const onPointerDown = (e) => {
        if (!this.state.open) {
          return;
        }
        this._handleUserActivity();
        this._swipeIntent = false;
        this._trackpadSwipeToClose = false;
        this.pointers.set(e.pointerId, e);
        if (this.pointers.size === POINTERS_COUNT) {
          this._isPinching = true;
          // calculate distance
          const [p1, p2] = Array.from(this.pointers.values());
          initialDistance = Math.hypot(
            p2.clientX - p1.clientX,
            p2.clientY - p1.clientY
          );
        }
      };
      const onPointerMove = (e) => {
        if (!this.pointers.has(e.pointerId)) {
          return;
        }
        if (!this.state.open) {
          this.pointers.clear();
          this._isPinching = false;
          return;
        }
        this._handleUserActivity();
        this.pointers.set(e.pointerId, e);
        if (this.pointers.size === POINTERS_COUNT) {
          const [p1, p2] = Array.from(this.pointers.values());
          const currentDistance = Math.hypot(
            p2.clientX - p1.clientX,
            p2.clientY - p1.clientY
          );
          if (initialDistance > 0) {
            const delta = currentDistance / initialDistance;
            initialDistance = currentDistance; // Update for next frame

            if (delta !== 1) {
              const sensitivity =
                e.pointerType === 'touch'
                  ? PINCH_SENSITIVITY_TOUCH
                  : PINCH_MODERATION;
              const moderatedDelta = 1 + (delta - 1) * sensitivity;

              const cx = (p1.clientX + p2.clientX) * CENTER_OFFSET;
              const cy = (p1.clientY + p2.clientY) * CENTER_OFFSET;
              this._zoomAtPoint(moderatedDelta, cx, cy);
            }
          }
        }
      };
      const onPointerUp = (e) => {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < POINTERS_COUNT) {
          this._isPinching = false;
          initialDistance = 0;
        }
      };
      // Attach to image node
      this.nodes.canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    // Open a collection by index, show item index
    openCollection(collectionIndex, itemIndex = 0) {
      if (!this.collections[collectionIndex]) {
        return;
      }
      this.state.open = true;
      this.state.collectionIndex = collectionIndex;
      this.state.itemIndex = itemIndex;
      this._handleUserActivity();
      this._showOverlay();
      this._checkCalibration();
      this._loadItem();
    }

    _showOverlay() {
      this.overlay.style.display = 'block';
      this._lastFocused = document.activeElement;
      requestAnimationFrame(() => {
        this.overlay.classList.add('spot-open');
        this.overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        this._showUiImmediate();
        this._scheduleUiHide();
        this.nodes.shell.focus();
      });
    }

    close() {
      if (!this.state.open) {
        return;
      }
      this.overlay.classList.remove('spot-open');
      this.overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      this.state.open = false;
      this.state.fullscreen = false;
      this._exitFullscreen();
      this._updateFullscreenButton();
      clearTimeout(this._uiHideTimer);
      clearTimeout(this._wheelSwipeTimer);
      this._wheelSwipeAccum = 0;
      this._wheelMode = null;
      this._lastSwipeNavTime = 0;
      this._swipeModeLocked = false;
      this._lastWheelDeltaX = 0;
      this._pendingSlideDir = 0;
      this._hideUi();
      if (this._pendingCalibrationListener) {
        window.removeEventListener('wheel', this._pendingCalibrationListener);
        this._pendingCalibrationListener = null;
      }
      if (this.calibrationActive && this.nodes.calibration) {
        this.nodes.calibration.remove();
        this.nodes.calibration = null;
        this.nodes.calibrationProgress = null;
        this.nodes.calibrationText = null;
        this.calibrationActive = false;
        this.calibrationSource = null;
      }

      // small delay to allow animation
      setTimeout(() => {
        if (!this.state.open) {
          this.overlay.style.display = 'none';
        }
        if (this._lastFocused) {
          this._lastFocused.focus();
        }
      }, CLOSE_DELAY);
    }

    prev() {
      const c = this.collections[this.state.collectionIndex];
      if (!c) {
        return;
      }
      this.state.itemIndex =
        (this.state.itemIndex - 1 + c.items.length) % c.items.length;
      this._animateSlide(-1, () => this._loadItem());
    }

    next() {
      const c = this.collections[this.state.collectionIndex];
      if (!c) {
        return;
      }
      this.state.itemIndex = (this.state.itemIndex + 1) % c.items.length;
      this._animateSlide(1, () => this._loadItem());
    }

    _loadItem() {
      const coll = this.collections[this.state.collectionIndex];
      if (!coll) {
        return;
      }
      const item = coll.items[this.state.itemIndex];
      if (!item) {
        return;
      }

      // Capture requested slide direction immediately so rapid successive
      // navigations do not lose the intended animation direction.
      const slideDir = this._pendingSlideDir || 0;
      this._pendingSlideDir = 0;

      this._resetRenderState();

      // show spinner while loading
      this.nodes.imgNode.style.opacity = '0';
      this.nodes.imgNode.src = '';
      this.nodes.counter.textContent = `${this.state.itemIndex + 1} / ${
        coll.items.length
      }`;
      this._updateCaption(item.caption);
      if (this.liveRegion) {
        this.liveRegion.textContent = `Image ${this.state.itemIndex + 1} of ${
          coll.items.length
        }${item.caption ? ': ' + item.caption : ''}`;
      }

      // Load image directly into the overlay image node. This is simpler
      // and avoids some preload/CORS race conditions with separate Image().
      const node = this.nodes.imgNode;
      // Remove previous handlers to avoid multiple invocations
      node.onload = null;
      node.onerror = null;

      node.style.opacity = '0';
      node.src = ''; // clear current

      node.onload = () => {
        // Fit by height and show
        requestAnimationFrame(() => {
          this._fitImageToViewport();
          this._applyTransform({ immediate: true });
          this._playSlideIn(slideDir);
        });
      };

      node.onerror = () => {
        node.src = '';
        this._updateCaption('Failed to load image');
        node.style.opacity = '1';
      };

      // Trigger load
      node.src = item.src;
      if (/\.svg($|\?)/i.test(item.src)) {
        node.classList.add('spot-svg');
      } else {
        node.classList.remove('spot-svg');
      }

      if (node.complete && node.naturalWidth) {
        // cached image won't fire onload
        node.onload?.();
      }
    }

    _updateCaption(text) {
      if (!this.nodes || !this.nodes.caption) {
        return;
      }
      const val = (text || '').trim();
      if (!val) {
        // No caption detected: hide caption element entirely
        this.nodes.caption.textContent = '';
        this.nodes.caption.classList.add('spot-caption-empty');
        this.nodes.caption.style.display = 'none';
      } else {
        // Show caption
        this.nodes.caption.textContent = val;
        this.nodes.caption.classList.remove('spot-caption-empty');
        this.nodes.caption.style.display = '';
      }
    }

    _resetRenderState() {
      this.state.scale = 1;
      this.state.baseScale = 1;
      this.state.translateX = 0;
      this.state.translateY = 0;
      this.renderState.scale = 1;
      this.renderState.translateX = 0;
      this.renderState.translateY = 0;
      this._renderActive = false;
      if (this.nodes.bg) {
        this.nodes.bg.style.opacity = '';
      }
      if (this.nodes.ui) {
        this.nodes.ui.style.opacity = '';
      }
      if (this.nodes.prevBtn) {
        this.nodes.prevBtn.style.opacity = '';
      }
      if (this.nodes.nextBtn) {
        this.nodes.nextBtn.style.opacity = '';
      }
      if (this.nodes.imgNode) {
        this.nodes.imgNode.style.opacity = '';
      }
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }

    _startRenderLoop() {
      if (this._rafId) {
        return;
      }
      this._renderActive = true;
      this._lastRenderTime = Date.now();
      this._renderLoop();
    }

    _renderLoop() {
      if (!this._renderActive || !this.state.open) {
        this._rafId = null;
        return;
      }

      const now = Date.now();
      const MAX_DT = 60;
      const MS_PER_SEC = 1000;
      const dt =
        Math.min(now - (this._lastRenderTime || now), MAX_DT) / MS_PER_SEC;
      this._lastRenderTime = now;

      const { scale, translateX, translateY } = this.state;
      const rs = this.renderState;

      // Time-based lerp: 1 - exp(-decay * dt)
      // Decay 15 is snappy, 10 is smoother
      const decay = 15;
      const f = 1 - Math.exp(-decay * dt);

      rs.scale += (scale - rs.scale) * f;
      rs.translateX += (translateX - rs.translateX) * f;
      rs.translateY += (translateY - rs.translateY) * f;

      this._checkConvergence(scale, translateX, translateY, rs);

      // Apply
      if (this.nodes.transform) {
        this.nodes.transform.style.transition = 'none';
        this.nodes.transform.style.transform = `translate(${rs.translateX}px, ${rs.translateY}px) scale(${rs.scale})`;
        this._updateZoomDisplay(rs.scale);

        this._updateSwipeAnimation(rs.translateY);

        const img = this.nodes.imgNode;
        img.style.cursor =
          Math.abs(rs.scale - (this.state.baseScale || 1)) >
            CURSOR_SCALE_THRESHOLD ||
          Math.abs(rs.translateX) > 1 ||
          Math.abs(rs.translateY) > 1
            ? 'grab'
            : 'zoom-out';
      }

      if (this._renderActive) {
        this._rafId = requestAnimationFrame(() => this._renderLoop());
      } else {
        this._rafId = null;
      }
    }

    _updateSwipeAnimation(translateY) {
      // For trackpad swipes, allow animation at any zoom level (trackpad uses different gesture for pan)
      // For touch swipes, only animate when zoomed out
      const isZoomedOut =
        Math.abs(this.state.scale - (this.state.baseScale || 1)) <
        PAN_THRESHOLD;

      // Allow animation if: zoomed out OR it's a trackpad-initiated swipe
      const allowAnimation = isZoomedOut || this._trackpadSwipeToClose;

      const nodesToFade = [
        this.nodes.bg,
        this.nodes.ui,
        this.nodes.prevBtn,
        this.nodes.nextBtn,
        this.nodes.imgNode,
      ];

      if (
        translateY > 0 &&
        this.state.open &&
        allowAnimation &&
        this._swipeIntent
      ) {
        const progress = Math.min(
          1,
          Math.abs(translateY) / SWIPE_CLOSE_DIVISOR
        );
        const opacity = 1 - progress;

        nodesToFade.forEach((node) => {
          if (node) {
            node.style.opacity = String(opacity);
          }
        });
      } else {
        nodesToFade.forEach((node) => {
          if (node) {
            node.style.opacity = '';
          }
        });
      }
    }

    _checkConvergence(scale, translateX, translateY, rs) {
      if (
        Math.abs(scale - rs.scale) < CONVERGENCE_SCALE &&
        Math.abs(translateX - rs.translateX) < CONVERGENCE_TRANSLATE &&
        Math.abs(translateY - rs.translateY) < CONVERGENCE_TRANSLATE
      ) {
        rs.scale = scale;
        rs.translateX = translateX;
        rs.translateY = translateY;
        this._renderActive = false;
        // Reset swipe intent when animation settles (e.g. bounce back complete)
        if (Math.abs(translateY) < 1) {
          this._swipeIntent = false;
        }
      }
    }

    _fitImageToViewport() {
      const img = this.nodes?.imgNode;
      if (!img) {
        return;
      }
      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      const intrinsicWidth = img.naturalWidth || img.width || img.clientWidth;
      const intrinsicHeight =
        img.naturalHeight || img.height || img.clientHeight;
      if (!intrinsicWidth || !intrinsicHeight) {
        return;
      }

      const scaleW = vw / intrinsicWidth;
      const scaleH = vh / intrinsicHeight;
      const viewportLandscape = vw >= vh;

      let baseScale = 1;

      if (viewportLandscape) {
        // Desktop / Landscape
        // If image fits in at least one dimension at 100%, use 100%.
        // Otherwise (too big in both), scale to fit the shortest viewport side (Height).
        const fitsWidth = intrinsicWidth <= vw;
        const fitsHeight = intrinsicHeight <= vh;

        if (fitsWidth || fitsHeight) {
          baseScale = 1;
        } else {
          baseScale = scaleH; // Shortest side in landscape is Height
        }
        // Cap at 1.0
        baseScale = Math.min(baseScale, 1);
      } else {
        // Mobile / Portrait
        // Use Contain logic (fit fully inside), but allow upscaling for small images.
        baseScale = Math.min(scaleW, scaleH);
      }

      baseScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE_FIT, baseScale));
      this.state.baseScale = baseScale;
      this.state.scale = baseScale;
      this.state.translateX = 0;
      this.state.translateY = 0;
      this.renderState.scale = baseScale;
      this.renderState.translateX = 0;
      this.renderState.translateY = 0;
    }

    _applyTransform(options = {}) {
      const immediate = options.immediate || !this.state.open;
      if (!this.nodes || !this.nodes.transform) {
        return;
      }

      const { scale, translateX, translateY } = this.state;
      const wrapper = this.nodes.transform;

      if (immediate) {
        wrapper.style.transition = 'none';
      } else {
        wrapper.style.transition = ''; // Use CSS default
      }

      wrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      this._updateZoomDisplay(scale);

      const img = this.nodes.imgNode;
      img.style.cursor =
        Math.abs(scale - (this.state.baseScale || 1)) >
          CURSOR_SCALE_THRESHOLD ||
        Math.abs(translateX) > 1 ||
        Math.abs(translateY) > 1
          ? 'grab'
          : 'zoom-out';
    }

    _updateZoomDisplay(scale) {
      if (!this.nodes || !this.nodes.zoomDisplay) {
        return;
      }
      const pct = Math.round((scale || 1) * PERCENTAGE);
      this.nodes.zoomDisplay.textContent = `${pct}%`;
      this.nodes.zoomDisplay.title = `Reset zoom (${pct}%)`;
    }

    _zoomBy(factor) {
      this._handleUserActivity();
      this.state.scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, this.state.scale * factor)
      );
      // adjust translate to keep center (approx)
      this._startRenderLoop();
    }

    _resetZoom() {
      this._handleUserActivity();
      this.state.scale = this.state.baseScale || 1;
      this.state.translateX = 0;
      this.state.translateY = 0;
      this._startRenderLoop();
    }

    _constrainAndSync() {
      const { naturalWidth, naturalHeight } = this.nodes.imgNode;
      const { clientWidth, clientHeight } = this.nodes.canvas;
      const currentW = naturalWidth * this.state.scale;
      const currentH = naturalHeight * this.state.scale;

      // Allow moving the image until only a small fraction (e.g. 5%) is visible
      // This prevents hard snapping when the image fits the viewport and allows
      // the user to move the image freely to inspect corners/background.
      const minVisibleRatio = 0.05;
      const limitX =
        clientWidth * CENTER_OFFSET +
        currentW * (CENTER_OFFSET - minVisibleRatio);
      const limitY =
        clientHeight * CENTER_OFFSET +
        currentH * (CENTER_OFFSET - minVisibleRatio);

      this.state.translateX = Math.min(
        limitX,
        Math.max(-limitX, this.state.translateX)
      );
      this.state.translateY = Math.min(
        limitY,
        Math.max(-limitY, this.state.translateY)
      );
    }

    _zoomAtPoint(factor, clientX, clientY) {
      this._handleUserActivity();
      this._swipeIntent = false;
      this._trackpadSwipeToClose = false;
      // Zoom keeping pointer anchored
      const rect = (
        this.nodes.transform || this.nodes.imgNode
      ).getBoundingClientRect();
      const imgCx = clientX - rect.left;
      const imgCy = clientY - rect.top;

      // Calculate delta based on rendered state (what user sees)
      const relX = imgCx / rect.width;
      const relY = imgCy / rect.height;

      // Update TARGET scale
      const prevTargetScale = this.state.scale;
      const newTargetScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, prevTargetScale * factor)
      );

      // Calculate new TARGET translation
      // We want the point (relX, relY) to be at (clientX, clientY) in the new target state.
      // Formula: tx = clientX - ViewportCenter - Width_target * (relX - 0.5)
      // Note: ViewportCenter is clientWidth/2, clientHeight/2
      const { clientWidth, clientHeight } = this.nodes.canvas;
      const { naturalWidth, naturalHeight } = this.nodes.imgNode;

      const targetWidth = naturalWidth * newTargetScale;
      const targetHeight = naturalHeight * newTargetScale;

      const targetTx =
        clientX -
        clientWidth * CENTER_OFFSET -
        targetWidth * (relX - CENTER_OFFSET);
      const targetTy =
        clientY -
        clientHeight * CENTER_OFFSET -
        targetHeight * (relY - CENTER_OFFSET);

      this.state.translateX = targetTx;
      this.state.translateY = targetTy;
      this.state.scale = newTargetScale;

      this._constrainAndSync();
      this._startRenderLoop();
    }

    // Programmatic helper to attach to external nodes (if needed)
    attachImage(imgEl, collectionIndex, itemIndex) {
      imgEl.dataset.spotlightCollection = String(collectionIndex);
      imgEl.dataset.spotlightIndex = String(itemIndex);
      imgEl.addEventListener('click', (e) => {
        e.preventDefault();
        this.openCollection(collectionIndex, itemIndex);
      });
    }

    _injectStyles() {
      if (document.getElementById('spotlight-styles')) {
        return;
      }
      const css = `
      :root {
        --spot-bg: rgba(6,6,8,1);
        --spot-ui-bg: rgba(20,20,24,0.78);
        --spot-ui-fg: rgba(255,255,255,0.95);
        --spot-muted: rgba(255,255,255,0.74);
        --spot-btn-bg: rgba(255,255,255,0.08);
        --spot-btn-border: rgba(255,255,255,0.1);
        --spot-shadow: 0 10px 40px rgba(0,0,0,0.45);
        --spot-anim: 300ms cubic-bezier(.22,.9,.35,1);
        --spot-font: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
      }
      @media (prefers-color-scheme: light) {
        :root {
          --spot-bg: rgba(250,250,252,1);
          --spot-ui-bg: rgba(255,255,255,0.8);
          --spot-ui-fg: rgba(17,17,20,0.92);
          --spot-muted: rgba(17,17,20,0.7);
          --spot-btn-bg: rgba(0,0,0,0.05);
          --spot-btn-border: rgba(0,0,0,0.1);
          --spot-shadow: 0 2px 80px rgba(0,0,0,0.15);
        }
        #spot-overlay .spot-nav {
          background: rgba(255,255,255,0.92);
          border-color: rgba(0,0,0,0.06);
          box-shadow: 0 6px 18px rgba(10,10,10,0.06);
        }
        #spot-overlay .spot-nav:hover {
          background: rgba(245,245,245,0.98);
        }
      }
      #spot-overlay { display:none; position:fixed; inset:0; z-index:2147483646; font-family:var(--spot-font); -webkit-font-smoothing:antialiased; opacity:0; transition:opacity var(--spot-anim); touch-action:none; }
      #spot-overlay, #spot-overlay * { -webkit-user-select:none; user-select:none; }
      #spot-overlay.spot-open { pointer-events:auto; opacity:1; }
      #spot-bg { position:fixed; inset:0; background:var(--spot-bg); transition:opacity var(--spot-anim); opacity:0; }
      #spot-shell { position:fixed; inset:0; pointer-events:none; opacity:0; transform:scale(0.996); transition:opacity var(--spot-anim), transform var(--spot-anim); }
      #spot-overlay.spot-open #spot-shell { opacity:1; transform:scale(1); }
      #spot-overlay.spot-open #spot-bg { opacity:1; }
      #spot-stage { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:2147483645; }
      #spot-canvas { position:absolute; inset:0; overflow:hidden; pointer-events:auto; display:flex; align-items:center; justify-content:center; }
      #spot-transform { will-change:transform; touch-action:none; transform-origin:center center; cursor:grab; transition: transform var(--spot-anim); }
      #spot-transform img { display:block; width:auto; height:auto; max-width:none; max-height:none; object-fit:contain; user-select:none; -webkit-user-drag:none; pointer-events:auto; transition:opacity 180ms ease; }
      #spot-transform img.spot-svg { width:100%; height:auto; max-width:100vw; max-height:100vh; }
      .spot-nav { position:absolute; top:50%; transform:translateY(-50%); width:50px; height:50px; border-radius:50%; background:rgba(0,0,0,0.35); color:var(--spot-ui-fg); border:1px solid rgba(255,255,255,0.12); backdrop-filter:blur(0px); box-shadow:var(--spot-shadow); display:flex; align-items:center; justify-content:center; font-size:0; cursor:pointer; pointer-events:auto; opacity:1; transition:background var(--spot-anim), transform var(--spot-anim), opacity var(--spot-anim), backdrop-filter var(--spot-anim); z-index:2147483650; }
      #spot-overlay.spot-open .spot-nav { backdrop-filter:blur(6px); }
      .spot-nav svg { width:30px; height:30px; opacity:0.5; transition:opacity var(--spot-anim); }
      .spot-nav:hover { background: rgba(0,0,0,0.45); }
      .spot-nav:hover svg { opacity:1; }
      .spot-nav[data-dir="-1"] { left:22px; --nav-offset: -40px; }
      .spot-nav[data-dir="1"] { right:22px; --nav-offset: 40px; }
      #spot-ui { position:fixed; inset:0; pointer-events:none; display:flex; flex-direction:column; justify-content:space-between; gap:20px; z-index:2147483647; }
      .spot-topbar, .spot-caption { pointer-events:auto; background:var(--spot-ui-bg); color:var(--spot-ui-fg);  box-shadow:var(--spot-shadow); backdrop-filter:blur(0px); transition: backdrop-filter var(--spot-anim); }
      #spot-overlay.spot-open .spot-topbar, #spot-overlay.spot-open .spot-caption { backdrop-filter:blur(18px); }
      .spot-topbar { display:flex; align-items:center; gap:18px; height:50px; }
      .spot-controls { margin-left:auto; display:flex; align-items:center; gap:10px; }
      .spot-controls svg { width:21px; height:21px; }
      .spot-controls .spot-btn { opacity:0.5; transition:opacity var(--spot-anim), background 150ms ease; will-change:opacity; }
      .spot-controls .spot-btn:hover { opacity:1; }
      .spot-counter {
        font-size:15px;
        font-weight:600;
        letter-spacing:0.08em;
        color:var(--spot-ui-fg);
        opacity:0.5;
        /* Reserve enough width for "XXX / XXX" without shifting layout.
           ch unit measures width of "0" in current font; choose a safe value. */
        min-width: 10ch;
        max-width: 12ch;
        height: 50px;
        padding: 15px;
        box-sizing: border-box;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        white-space: nowrap;
        /* Request monospaced digits so changing numbers don't change glyph widths */
        font-variant-numeric: tabular-nums;
        -webkit-font-feature-settings: "tnum" 1;
        font-feature-settings: "tnum" 1;
      }
      .spot-btn { width:50px; height:50px; border-radius:6px; border:none; background:transparent; color:var(--spot-ui-fg); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:600; cursor:pointer; transition:background 150ms ease; }
      .spot-btn:active { transform:none; }
      #spot-caption { padding:14px 18px; font-size:21px; line-height:1.45; color:var(--spot-muted); }
      #spot-caption.spot-caption-empty { opacity:0; pointer-events:none; }
      #spot-overlay.spot-nav-hidden .spot-nav { opacity:0; pointer-events:none; transform:translateY(-50%) translateX(var(--nav-offset)); }
      #spot-ui .spot-topbar, #spot-ui .spot-caption { transition:opacity var(--spot-anim), transform var(--spot-anim); will-change:opacity, transform; }
      #spot-ui.spot-ui-hidden .spot-topbar { opacity:0; transform:translateY(-18px); pointer-events:none; }
      #spot-ui.spot-ui-hidden .spot-caption { opacity:0; transform:translateY(18px); pointer-events:none; }
      #spot-ui.spot-ui-visible .spot-topbar, #spot-ui.spot-ui-visible .spot-caption { opacity:1; transform:translateY(0); }
      @media (max-width:600px) {
        #spot-ui { flex-direction: column-reverse;}
        #spot-fullscreen { display:none; }
        .spot-topbar { gap:10px; height:75px; padding 0 24px;}
        .spot-controls svg { width: 25px; height: 25px; }
        #spot-caption {font-size:16px;}
        .spot-nav { display:none; }
        .spot-nav[data-dir="-1"] { left:10px; --nav-offset: -20px; }
        .spot-nav[data-dir="1"] { right:10px; --nav-offset: 20px; }
      }
      @media (prefers-reduced-motion: reduce) {
        :root { --spot-anim: 0s; }
        #spot-transform { transition: none; }
      }
      
      /* Calibration */
      .spot-calibration { position:fixed; inset:0; z-index:2147483660; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.3s ease; }
      .spot-calibration.visible { opacity:1; pointer-events:auto; }
      .spot-calibration-content { background:var(--spot-ui-bg); color:var(--spot-ui-fg); padding:40px; border-radius:12px; text-align:center; max-width:400px; box-shadow:var(--spot-shadow); backdrop-filter:blur(10px); }
      .spot-calibration h3 { margin:0 0 15px; font-size:20px; }
      .spot-calibration p { margin:0 0 30px; opacity:0.8; line-height:1.5; }
      
      /* Trackpad Animation Styles */
      .trackpad-container { transform: scale(0.6); margin: 0 auto; width: 400px; }
      .trackpad { width: 400px; height: 250px; background: #ffffff; border-radius: 20px; border: 2px solid #ccc; position: relative; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin: 0 auto; }
      .finger { width: 32px; height: 32px; background: #007AFF; box-shadow: 0 2px 10px rgba(0, 122, 255, 0.4); border-radius: 50%; position: absolute; }
      
      .spot-progress-bar { width: 100%; height: 6px; background: rgba(128,128,128,0.2); border-radius: 3px; margin-top: 25px; overflow: hidden; }
      .spot-progress-value { width: 0%; height: 100%; background: #007AFF; transition: width 0.1s linear; }

      /* Animations */
      .finger.swipe-down { left: 50%; transform: translateX(-50%); animation: swipeDown 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      @keyframes swipeDown { 0% { top: 40px; opacity: 0; transform: translateX(-50%) scale(0.8); } 10% { opacity: 1; transform: translateX(-50%) scale(1); } 60% { top: 180px; opacity: 1; transform: translateX(-50%) scale(1); box-shadow: 0 2px 10px rgba(0, 122, 255, 0.4); } 75% { top: 180px; opacity: 0; transform: translateX(-50%) scale(1.5); box-shadow: 0 0 0 20px rgba(0, 122, 255, 0); } 100% { top: 180px; opacity: 0; } }
      `;

      const style = create('style', {
        id: 'spotlight-styles',
        type: 'text/css',
      });
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    }

    _handleKeydown(e) {
      if (!this.state.open) {
        return;
      }
      this._handleUserActivity();

      const code = e.code;
      const key = e.key;
      const kLower = key.toLowerCase();

      if (code === 'Escape' || key === 'Escape' || key === 'Esc') {
        this.close();
        return;
      }

      if (this._handleNavigationKey(code, kLower)) {
        return;
      }
      if (this._handleZoomKey(code, key)) {
        return;
      }

      if (['Digit0', 'Numpad0'].includes(code) || ['0', ')'].includes(key)) {
        this._resetZoom();
        return;
      }

      // Fullscreen
      if (code === 'KeyF' || kLower === 'f') {
        this._toggleFullscreen();
      }
    }

    _handleNavigationKey(code, kLower) {
      if (
        ['ArrowRight', 'KeyL', 'Right'].includes(code) ||
        ['arrowright', 'right', 'l'].includes(kLower)
      ) {
        this.next();
        return true;
      }
      if (
        ['ArrowLeft', 'KeyH', 'Left'].includes(code) ||
        ['arrowleft', 'left', 'h'].includes(kLower)
      ) {
        this.prev();
        return true;
      }
      return false;
    }

    _handleZoomKey(code, key) {
      if (['Equal', 'NumpadAdd'].includes(code) || ['+', '='].includes(key)) {
        this._zoomBy(ZOOM_FACTOR);
        return true;
      }
      if (
        ['Minus', 'NumpadSubtract'].includes(code) ||
        ['-', '_'].includes(key)
      ) {
        this._zoomBy(1 / ZOOM_FACTOR);
        return true;
      }
      return false;
    }

    _handlePointerMove(e) {
      if (this._dragPointerId !== e.pointerId) {
        return;
      }
      this._handleUserActivity();

      // If pinching, cancel drag to avoid conflict
      if (this._isPinching) {
        this._dragPointerId = null;
        return;
      }

      // Check for swipe down start
      if (!this._isVerticalSwipe && this._dragStart) {
        this._checkForVerticalSwipe(e);
      }

      if (this._isVerticalSwipe) {
        const dy = e.clientY - this._dragLast.y;
        this.state.translateY += dy;
        this._dragLast.x = e.clientX;
        this._dragLast.y = e.clientY;
        this._startRenderLoop();
        return;
      }

      // Disable pan without zoom on mobile/touch
      if (
        e.pointerType === 'touch' &&
        Math.abs(this.state.scale - (this.state.baseScale || 1)) < PAN_THRESHOLD
      ) {
        return;
      }

      const dx = e.clientX - this._dragLast.x;
      const dy = e.clientY - this._dragLast.y;
      this._dragLast.x = e.clientX;
      this._dragLast.y = e.clientY;
      this.state.translateX += dx;
      this.state.translateY += dy;
      this._constrainAndSync();
      this._startRenderLoop();
    }

    _checkForVerticalSwipe(e) {
      // Only allow swipe-to-close on touch devices
      if (e.pointerType !== 'touch') {
        // For mouse/pen, treat as normal pan (fall through)
        return;
      }

      const totalDy = e.clientY - this._dragStart.y;
      const totalDx = e.clientX - this._dragStart.x;
      const isZoomedOut =
        Math.abs(this.state.scale - (this.state.baseScale || 1)) <
        PAN_THRESHOLD;

      if (
        isZoomedOut &&
        totalDy > 0 &&
        Math.abs(totalDy) > Math.abs(totalDx) &&
        totalDy > SWIPE_THRESHOLD_PX
      ) {
        this._isVerticalSwipe = true;
        this._swipeIntent = true;
      }
    }

    _handleTouchEnd(e) {
      if (!this.state.open || !this.touchStart) {
        return;
      }
      this._handleUserActivity();
      const endX =
        (e.changedTouches &&
          e.changedTouches[0] &&
          e.changedTouches[0].clientX) ||
        0;
      const endY =
        (e.changedTouches &&
          e.changedTouches[0] &&
          e.changedTouches[0].clientY) ||
        0;
      const dx = endX - this.touchStart.x;
      const dy = endY - this.touchStart.y;
      const dt = Date.now() - this.touchStart.t;
      this.touchStart = null;

      if (this._isValidSwipe(dx, dy, dt)) {
        if (dx < 0) {
          this.next();
        } else {
          this.prev();
        }
      }
    }

    _isValidSwipe(dx, dy, dt) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      return (
        absDx > absDy &&
        absDx > SWIPE_THRESHOLD_PX &&
        dt < SWIPE_TIMEOUT &&
        Math.abs(this.state.scale - (this.state.baseScale || 1)) <
          SWIPE_SCALE_THRESHOLD
      );
    }
  }

  function initSpotlight() {
    if (window.__spotlight_instance) {
      return window.__spotlight_instance;
    }
    const inst = new Spotlight();
    window.__spotlight_instance = inst;
    return inst;
  }

  window.addEventListener('click', (e) => {
    const target = e.target.closest('img');
    if (!target) {
      return;
    }
    const container = target.closest('article, .gallery');
    if (!container) {
      return;
    }

    e.preventDefault();
    const inst = initSpotlight();
    const collIndex = parseInt(target.dataset.spotlightCollection || '0', 10);
    const itemIndex = parseInt(target.dataset.spotlightIndex || '0', 10);
    inst.openCollection(collIndex, itemIndex);
  });

  // Expose a minimal public API
  window.Spotlight = {
    get instance() {
      return window.__spotlight_instance || null;
    },
    get debug() {
      return (
        (window.__spotlight_instance && window.__spotlight_instance.debug) ||
        false
      );
    },
    set debug(val) {
      const v = Boolean(val);
      window.__spotlight_debug__ = v;
      if (window.__spotlight_instance) {
        window.__spotlight_instance.debug = v;
      }
    },
    open: (collectionIndex = 0, itemIndex = 0) => {
      if (!window.__spotlight_instance) {
        initSpotlight();
      }
      window.__spotlight_instance.openCollection(collectionIndex, itemIndex);
    },
    rescan: () => {
      // Re-scan page (e.g. after dynamic content load)
      const inst = window.__spotlight_instance || initSpotlight();
      // Simple strategy: rebuild instance
      try {
        // remove overlay if present
        if (inst.overlay && inst.overlay.parentNode) {
          inst.overlay.parentNode.removeChild(inst.overlay);
        }
      } catch (err) {
        if (inst && typeof inst._reportError === 'function') {
          inst._reportError('rescan.removeOverlay', err);
        }
      }
      delete window.__spotlight_instance;
      return initSpotlight();
    },
    getCapturedErrors: () => {
      return (
        (window.__spotlight_instance &&
          window.__spotlight_instance._getCapturedErrors()) ||
        []
      );
    },
    clearCapturedErrors: () => {
      if (window.__spotlight_instance) {
        window.__spotlight_instance._clearCapturedErrors();
      }
    },
  };
})();
