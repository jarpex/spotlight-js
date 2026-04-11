/*!
 * Spotlight JS v1.0.4
 * Copyright (c) 2026 Anastasia Shebalkina
 * Licensed under the MIT License (see LICENSE)
 *
 * Includes Tabler Icons (https://tabler.io/icons), MIT License
 * Copyright (c) 2020-2026 Tabler Icons Authors (see LICENSE.tabler-icons)
 */

(() => {
  'use strict';

  // Internal state moved from window to closure for better encapsulation
  let __spotlight_instance = null;
  let __spotlight_debug__ = false;

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  // All magic numbers and configuration values are centralized here for
  // maintainability. Grouped by functional area.

  // --- Security ---
  // Make sure to disable file: and blob: schemes for images if integrating with WebView/Electron to mitigate potential exploits
  const BLOCKED_URL_PROTOCOLS = ['javascript:', 'vbscript:'];
  const SAFE_IMAGE_PROTOCOLS = ['http:', 'https:', 'data:'];

  // --- Event Handling ---

  // --- ID Generation ---
  const ID_BASE = 36; // Base for random ID generation
  const ID_SLICE_START = 2; // Start index for random ID slicing
  const ID_SLICE_END = 9; // End index for random ID slicing

  // --- Zoom & Scale ---
  const ZOOM_FACTOR = 1.2; // Factor to zoom in/out by
  const MAX_SCALE = 8; // Maximum zoom scale
  const MIN_SCALE = 0.2; // Minimum zoom scale
  const MIN_SCALE_FIT = 0.05; // Minimum scale when fitting to viewport
  const PERCENTAGE = 100; // Multiplier for percentage display
  const CENTER_OFFSET = 0.5; // Center offset for zoom calculation (0.5 = center)
  const TRACKPAD_PINCH_SENSITIVITY = 0.01; // Base sensitivity for trackpad pinch zoom

  // --- Pinch Gesture ---
  const PINCH_SENSITIVITY_TOUCH = 1.1; // Sensitivity for touch devices

  // --- Pan & Swipe (Touch) ---
  const PAN_THRESHOLD = 0.1; // Threshold for panning vs zooming on touch
  const SWIPE_TIMEOUT = 500; // Max time for a swipe gesture (ms)
  const SWIPE_SCALE_THRESHOLD = 0.25; // Max scale deviation to allow swipe navigation
  const SWIPE_THRESHOLD_PX = 20; // Minimum pixel distance for a swipe
  const SWIPE_DOWN_THRESHOLD = 100; // Pixels to drag down to close
  const SWIPE_CLOSE_DIVISOR = 150; // Divisor for swipe-to-close animation progress
  const MIN_VISIBLE_RATIO = 0.05; // Min visible fraction when panning image

  // --- Wheel Interaction ---
  const SWIPE_DEBOUNCE = 500; // Debounce time for rapid swipes (ms)
  const WHEEL_RATIO_THRESHOLD = 0.65; // Ratio of X to Y delta for horizontal swipe detection
  const WHEEL_Y_THRESHOLD = 10; // Max Y delta for horizontal swipe detection
  const WHEEL_RESET_DELAY = 80; // Delay to reset wheel gesture state (ms)
  const MOUSE_WHEEL_NAV_DEBOUNCE = 300; // Debounce time for mouse wheel navigation (ms)
  const MOUSE_WHEEL_NAV_THRESHOLD = 2; // Minimum deltaY to trigger mouse wheel navigation
  const WHEEL_ACCELERATION_THRESHOLD = 5; // Threshold for wheel acceleration detection
  const UNLOCK_WHEEL_GAP = 150; // Time gap to unlock wheel mode
  const TRACKPAD_SWIPE_THRESHOLD = 20; // Pixel threshold for trackpad horizontal swipe
  const DELTA_THRESHOLD_MIN = 1; // Minimum delta to consider gesture started
  const DELTA_DIFF_THRESHOLD = 1; // Minimum delta difference for horizontal detection

  // --- WheelEvent Constants ---
  const DOM_DELTA_PIXEL = 0; // WheelEvent.DOM_DELTA_PIXEL
  // Standard fixed-step values used by some physical mouse wheels.
  // `deltaY === 100` is a common fixed vertical step; `wheelDelta === 120` is legacy.
  const MOUSE_WHEEL_DELTA_FIXED = 100;
  const MOUSE_WHEEL_WHEELDELTA_FIXED = 120;

  // --- Input & Calibration ---
  const INPUT_DETECTION_DELAY = 400; // Delay for input detection (ms)
  const CALIBRATION_COOLDOWN = 800; // Cooldown after calibration (ms)
  const CALIBRATION_CLOSE_DELAY = 300; // Delay to close calibration (ms)
  const CALIBRATION_TARGET = 80; // Target accumulator value for calibration step

  // --- Animation & UI ---
  const SLIDE_OFFSET = 60; // Pixel offset for slide animation
  const SLIDE_IN_DURATION = 650; // Duration of slide-in animation (ms)
  const SLIDE_IN_OPACITY_DURATION = 400; // Duration of slide-in opacity transition (ms)
  const SLIDE_SCALE_INITIAL = 0.96; // Initial scale for slide-in animation
  const CLOSE_DELAY = 220; // Delay before removing overlay from DOM after close (ms)
  const UI_HIDE_DELAY = 1500; // Delay before hiding UI after inactivity (ms)
  const WEAKREF_CLEANUP_INTERVAL = 30000; // 30 seconds in ms

  // --- Error Tracking ---
  const MAX_CAUGHT_ERRORS = 200; // Maximum number of caught errors to retain

  // --- Render Loop ---
  const CONVERGENCE_SCALE = 0.001; // Convergence threshold for scale animation
  const CONVERGENCE_TRANSLATE = 0.1; // Convergence threshold for translate animation
  const CURSOR_SCALE_THRESHOLD = 0.02; // Threshold for changing cursor to grab
  const LERP_DECAY = 15; // Time-based lerp decay factor (higher = snappier)
  const MAX_FRAME_DT = 60; // Max frame delta time to prevent jumps (ms)
  const MS_PER_SECOND = 1000; // Milliseconds per second

  // --- Storage Keys ---
  const LS_KEY_NATURAL = 'spotlight-natural-scrolling';

  // --- Accessibility ---
  const ANNOUNCE_CLEAR_DELAY = 1000; // Delay to clear live announcements (ms)
  const COMPLETION_ANNOUNCE_OFFSET = 200; // Additional delay for completion message

  // --- CSS Classes ---
  const CLASS_UI_HIDDEN = 'spot-ui-hidden';
  const CLASS_UI_VISIBLE = 'spot-ui-visible';
  const CLASS_NAV_HIDDEN = 'spot-nav-hidden';
  const CLASS_OPEN = 'spot-open';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  const DEFAULT_CONFIG = {
    cspNonce: null,
    allowLocalFiles: false,
    // Hard limit to prevent memory abuse from massive inline payloads.
    maxDataUrlLength: 2_000_000,
    // Restrict inline data:image MIME types to common safe formats.
    allowedDataImageMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/avif',
    ],
    // Optional hook to surface internal errors in production monitoring.
    onError: null,
    // Limit auto-init click delegation scope to gallery roots.
    autoInitRootSelector: 'article, .gallery',
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Query selector shorthand that returns an array of elements.
   * @param {string} sel - CSS selector
   * @param {Element|Document} root - Root element to search from
   * @returns {Element[]} Array of matching elements
   */
  const $$ = (sel, root = document) => {
    try {
      return Array.from(root.querySelectorAll(sel));
    } catch {
      return [];
    }
  };

  /**
   * Creates a DOM element with the specified attributes and children.
   * Supports special handling for 'style', 'on*' event handlers, and 'dataset'.
   * @param {string} tag - HTML tag name
   * @param {Object} attrs - Attributes to set on the element
   * @param {Array<string|Element>} children - Child nodes to append
   * @returns {Element} The created element
   */
  const create = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      // Security: Protect against Prototype Pollution
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        return;
      }

      if (k === 'style' && v && typeof v === 'object') {
        Object.entries(v).forEach(([sk, sv]) => {
          if (
            sk !== '__proto__' &&
            sk !== 'constructor' &&
            sk !== 'prototype'
          ) {
            el.style[sk] = sv;
          }
        });
      } else if (k.startsWith('on')) {
        // Only allow function handlers. String handlers (onclick="...") are blocked.
        if (typeof v === 'function') {
          // eslint-disable-next-line no-magic-numbers
          el.addEventListener(k.slice(2), v);
        }
      } else if (k === 'dataset' && v && typeof v === 'object') {
        Object.entries(v).forEach(([dk, dv]) => {
          if (
            dk !== '__proto__' &&
            dk !== 'constructor' &&
            dk !== 'prototype'
          ) {
            el.dataset[dk] = dv;
          }
        });
      } else {
        el.setAttribute(k, v);
      }
    });
    children.forEach((c) =>
      typeof c === 'string'
        ? el.appendChild(document.createTextNode(c))
        : el.appendChild(c),
    );
    return el;
  };

  const _iconCache = {};

  /**
   * Helper to create an SVG icon element using createElementNS.
   * @param {string[]} paths - Array of path 'd' attributes
   * @param {string} className - Additional CSS classes
   * @returns {Element} SVG element
   */
  const createIcon = (paths, className = '') => {
    const key = paths.join('') + className;
    if (_iconCache[key]) {
      return _iconCache[key].cloneNode(true);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const attrs = {
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    };
    Object.entries(attrs).forEach(([k, v]) => svg.setAttribute(k, v));

    if (className) {
      svg.classList.add(
        'icon',
        'icon-tabler',
        'icons-tabler-outline',
        ...className.split(' ').filter(Boolean),
      );
    }

    // Default Tabler background path
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bg.setAttribute('stroke', 'none');
    bg.setAttribute('d', 'M0 0h24v24H0z');
    bg.setAttribute('fill', 'none');
    svg.appendChild(bg);

    paths.forEach((d) => {
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      path.setAttribute('d', d);
      svg.appendChild(path);
    });

    _iconCache[key] = svg;
    return svg.cloneNode(true);
  };

  // ============================================================================
  // SVG ICONS
  // ============================================================================

  const PATHS_MAXIMIZE = [
    'M16 4l4 0l0 4',
    'M14 10l6 -6',
    'M8 20l-4 0l0 -4',
    'M4 20l6 -6',
    'M16 20l4 0l0 -4',
    'M14 14l6 6',
    'M8 4l-4 0l0 4',
    'M4 4l6 6',
  ];
  const PATHS_MINIMIZE = [
    'M5 9l4 0l0 -4',
    'M3 3l6 6',
    'M5 15l4 0l0 4',
    'M3 21l6 -6',
    'M19 9l-4 0l0 -4',
    'M15 9l6 -6',
    'M19 15l-4 0l0 4',
    'M15 15l6 6',
  ];
  const PATHS_PREV = ['M13 20l-3 -8l3 -8'];
  const PATHS_NEXT = ['M11 4l3 8l-3 8'];
  const PATHS_ZOOM_OUT = [
    'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
    'M7 10l6 0',
    'M21 21l-6 -6',
  ];
  const PATHS_ZOOM_IN = [
    'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
    'M7 10l6 0',
    'M10 7l0 6',
    'M21 21l-6 -6',
  ];
  const PATHS_CLOSE = ['M18 6l-12 12', 'M6 6l12 12'];

  // ============================================================================
  // SPOTLIGHT CLASS
  // ============================================================================

  /**
   * Spotlight - A lightweight, dependency-free image gallery viewer.
   *
   * Features:
   * - Automatic collection detection from <article> and .gallery containers
   * - Smooth animations with time-based interpolation
   * - Touch, mouse, and trackpad gesture support
   * - Pinch-to-zoom and pan functionality
   * - Keyboard navigation and accessibility support
   * - Fullscreen mode
   *
   * @class
   */
  class Spotlight {
    #rafId = null;
    #renderActive = false;
    #uiHideTimer = null;
    #uiHideDelay = UI_HIDE_DELAY;
    #wheelSwipeAccum = 0;
    #wheelSwipeTimer = null;
    #wheelMode = null; // 'swipe' | 'zoom'
    #lastSwipeNavTime = 0; // Timestamp of last horizontal swipe navigation
    #lastWheelEventTime = 0; // Timestamp of last wheel event (for inertia detection)
    #lastWheelDeltaX = 0; // Magnitude of last wheel delta X (for acceleration detection)
    #lastMouseWheelNav = 0; // Timestamp of last mouse wheel navigation
    #swipeModeLocked = false; // True during debounce after navigation
    #trackpadSwipeToClose = false; // Flag for trackpad swipe to close gesture
    #pendingSlideDir = 0;
    #dragPointerId = null;
    #dragLast = { x: 0, y: 0 };
    #dragStart = null;
    #isPinching = false;
    #caughtErrors = [];
    #abortController = null;
    #lastTouchTime = 0;
    #wheelSource = null;
    #hasTrackpad = false;
    #pendingCalibrationListener = null;
    #lastFocusedBeforeCalibration = null;
    #calibrationKeydownHandler = null;
    #calibrationFocusable = null;
    #pointerOverUi = false;
    #pointerOverUiCount = 0;
    #isVerticalSwipe = false;
    #swipeIntent = false;
    #lastRenderTime = 0;
    #resizeObserver = null;
    #canvasRectCache = null;
    #lastFocused = null;
    #uiShowTimer = null;
    #scannedImages = new WeakSet();
    #attachedListeners = new WeakMap();
    #trackedElements = new Set(); // Store WeakRef<Element> for cleanup
    #managedListeners = [];
    #observer = null;
    #fadeableNodesCache = null;
    #pendingTimers = new Set();
    #weakRefCleanupTimer = null;
    #cssInjected = false;

    #addTimer(callback, delay) {
      const id = setTimeout(() => {
        this.#pendingTimers.delete(id);
        if (this.overlay) {
          callback();
        }
      }, delay);
      this.#pendingTimers.add(id);
      return id;
    }

    /**
     * Creates a new Spotlight instance.
     * Initializes state, detects input methods, injects styles, and creates the overlay.
     */
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

      this.renderState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
      };

      this.pointers = new Map();
      // Debug mode: allow console output for debugging if enabled
      this.debug = Boolean(__spotlight_debug__);

      if (typeof AbortController === 'function') {
        this.#abortController = new AbortController();
      }

      // Input modality detection
      this.#hasTrackpad =
        (document.body && document.body.classList.contains('using-trackpad')) ||
        false;

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

      this.#checkCSP();

      this.#init();

      // Start scheduled cleanup for expired WeakRefs
      this.#scheduleWeakRefCleanup();
    }

    /**
     * @internal — exposed for window.Spotlight API; not part of the public contract.
     */
    _reportError(op, err) {
      try {
        if (this.#caughtErrors.length >= MAX_CAUGHT_ERRORS) {
          this.#caughtErrors.shift();
        }
        this.#caughtErrors.push({ op, err, time: Date.now() });
      } catch (e) {
        // If the array is not writable for some reason, fall back to noop
        if (this.debug && globalThis.console && globalThis.console.error) {
          globalThis.console.error(`[Spotlight] Failed to capture error:`, e);
        }
      }
      if (
        this.debug &&
        typeof globalThis !== 'undefined' &&
        globalThis.console &&
        globalThis.console.warn
      ) {
        globalThis.console.warn(`[Spotlight] ${op}:`, err);
      }
      this.#notifyErrorHook(op, err);
    }

    /**
     * Notifies the configured error hook (optional production telemetry).
     * @param {string} op - Operation name
     * @param {Error} err - Error object
     * @private
     */
    #notifyErrorHook(op, err) {
      // Optional escalation hook for production telemetry.
      try {
        const config =
          (window.Spotlight && window.Spotlight.config) || DEFAULT_CONFIG;
        if (typeof config.onError === 'function') {
          config.onError({ op, err, time: Date.now() });
        }
      } catch {
        // Never throw from internal error reporter.
      }
    }

    /**
     * @internal — exposed for window.Spotlight API; not part of the public contract.
     */
    _getCapturedErrors() {
      return Array.from(this.#caughtErrors || []);
    }

    /**
     * @internal — exposed for window.Spotlight API; not part of the public contract.
     */
    _clearCapturedErrors() {
      this.#caughtErrors = [];
    }

    #getListenerOptions(options = {}) {
      if (this.#abortController) {
        return { ...options, signal: this.#abortController.signal };
      }
      return { ...options };
    }

    #addManagedListener(target, type, handler, options = {}) {
      if (!target || typeof target.addEventListener !== 'function') {
        return;
      }

      const listenerOptions = this.#getListenerOptions(options);
      target.addEventListener(type, handler, listenerOptions);

      if (!this.#abortController) {
        this.#managedListeners.push({ target, type, handler, options });
      }
    }

    #cleanupManagedListeners() {
      if (!this.#managedListeners.length) {
        return;
      }

      const listeners = this.#managedListeners;
      this.#managedListeners = [];
      listeners.forEach(({ target, type, handler, options }) => {
        if (target && typeof target.removeEventListener === 'function') {
          target.removeEventListener(type, handler, options);
        }
      });
    }

    #checkCSP() {
      try {
        const cspMeta = document.querySelector(
          'meta[http-equiv="Content-Security-Policy"]',
        );
        if (cspMeta && this.debug) {
          this._reportError(
            'csp',
            new Error(
              'Content-Security-Policy detected. Inline style injection can be restricted by host policy.',
            ),
          );
        }
      } catch (err) {
        this._reportError('csp.check', err);
      }
    }

    #sanitizeText(text) {
      if (typeof text !== 'string') {
        return '';
      }
      return text.replace(/[\x00-\x1f\x7f]+/g, '').trim();
    }

    #sanitizeCollectionIndex(value) {
      const idx = Number.parseInt(String(value), 10);
      return Number.isInteger(idx) && idx >= 0 ? idx : null;
    }

    #isEditableTarget(target) {
      if (!target || target.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      const el = /** @type {Element} */ (target);
      if (el.isContentEditable) {
        return true;
      }
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    /**
     * Validates and normalizes an image URL candidate.
     * Relative paths are allowed, absolute URLs are protocol-checked.
     * @param {string} rawUrl - The raw URL string to validate
     * @returns {string|null} Sanitized URL or null if invalid
     * @private
     */
    #getSafeImageUrl(rawUrl) {
      if (typeof rawUrl !== 'string') {
        return null;
      }
      const candidate = rawUrl.trim();
      if (!candidate) {
        return null;
      }
      // Handle simple cases (relative paths or data URIs)
      const isAbsolute = candidate.includes('://');
      const isData = candidate.toLowerCase().startsWith('data:');
      if (!isAbsolute && !isData) {
        // If it looks like a protocol but doesn't have :// (e.g., javascript:)
        if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
          // Fall through to full URL validation
        } else {
          return candidate; // Assume relative path
        }
      }
      try {
        const url = new window.URL(candidate, window.location.href);
        return this.#validateUrlProtocol(url);
      } catch (err) {
        this._reportError('getSafeImageUrl.parse', err);
        return null;
      }
    }

    /**
     * Validates URL protocol against allowed/blocked lists.
     * @param {URL} url - URL object to validate
     * @returns {string|null} Validated URL or null if blocked
     * @private
     */
    #validateUrlProtocol(url) {
      const protocol = (url.protocol || '').toLowerCase();
      if (BLOCKED_URL_PROTOCOLS.includes(protocol)) {
        return null;
      }
      const config =
        (window.Spotlight && window.Spotlight.config) || DEFAULT_CONFIG;
      const isLocal = protocol === 'file:' || protocol === 'blob:';
      if (isLocal) {
        return config.allowLocalFiles ? url.href : null;
      }
      if (protocol === 'data:') {
        return this.#isAllowedDataImageUrl(url.href, config) ? url.href : null;
      }
      return SAFE_IMAGE_PROTOCOLS.includes(protocol) ? url.href : null;
    }

    /**
     * Applies DoS guards for data:image URLs by MIME whitelist and length limit.
     * @param {string} dataUrl
     * @param {typeof DEFAULT_CONFIG} config
     * @returns {boolean}
     */
    #isAllowedDataImageUrl(dataUrl, config) {
      if (typeof dataUrl !== 'string') {
        return false;
      }

      const maxLen = Number(config.maxDataUrlLength);
      if (Number.isFinite(maxLen) && maxLen > 0 && dataUrl.length > maxLen) {
        this._reportError(
          'dataUrl.length',
          new Error(
            `Blocked data URL longer than maxDataUrlLength (${maxLen})`,
          ),
        );
        return false;
      }

      const match = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(dataUrl);
      const mime = (match && match[1] ? match[1] : '').toLowerCase();
      if (!mime.startsWith('image/')) {
        return false;
      }

      const allowList = Array.isArray(config.allowedDataImageMimeTypes)
        ? config.allowedDataImageMimeTypes.map((m) => String(m).toLowerCase())
        : [];

      if (allowList.length > 0 && !allowList.includes(mime)) {
        this._reportError(
          'dataUrl.mime',
          new Error(`Blocked unsupported data URL MIME type: ${mime}`),
        );
        return false;
      }

      return true;
    }

    /**
     * Checks whether an image belongs to the current collection container,
     * excluding images nested inside child article/.gallery containers.
     * @param {Element} img
     * @param {Element} container
     * @returns {boolean}
     */
    #isImageInContainer(img, container) {
      let node = img.parentElement;
      while (node && node !== container) {
        const tag = (node.tagName || '').toLowerCase();
        if (tag === 'article' || node.classList.contains('gallery')) {
          return false;
        }
        node = node.parentElement;
      }
      return node === container;
    }

    #init() {
      this.#detectInputMethod();
      this.#injectStyles();
      this.#scanCollections();
      this.#createOverlay();

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

      this.#bindGlobalListeners();
    }

    #detectInputMethod() {
      this.#addManagedListener(
        window,
        'touchstart',
        () => {
          this.#lastTouchTime = window.performance.now();
          this.#setInputMode('touch');
        },
        { passive: true },
      );
    }

    #trackpadResetTimer = null;

    #determineWheelSource(event) {
      if (!event) {
        return this.#wheelSource || 'mouse';
      }

      // Guard against synthetic events fired while touching the screen.
      const now = window.performance.now();
      if (now - (this.#lastTouchTime || 0) < INPUT_DETECTION_DELAY) {
        return this.#wheelSource || 'mouse';
      }

      const isTrackpad = this.#isTrackpadWheel(event);
      const source = isTrackpad ? 'trackpad' : 'mouse';

      if (isTrackpad) {
        this.#hasTrackpad = true;
        if (this.#trackpadResetTimer !== null) {
          clearTimeout(this.#trackpadResetTimer);
        }
        this.#trackpadResetTimer = setTimeout(() => {
          this.#hasTrackpad = false;
          this.#wheelSource = 'mouse';
          this.#setInputMode('mouse');
          // eslint-disable-next-line no-magic-numbers
        }, 2000);
      }

      // Only update mode if it actually changed, allowing seamless switching
      // between mouse and trackpad on the fly for hybrid setups.
      if (source !== this.#wheelSource) {
        this.#setInputMode(source);
      }

      this.#wheelSource = source;

      return source;
    }

    #setInputMode(mode) {
      const body = document.body;
      if (!body) {
        return;
      }
      body.classList.remove('using-touch', 'using-mouse', 'using-trackpad');
      if (mode === 'touch') {
        body.classList.add('using-touch');
      } else if (mode === 'trackpad') {
        body.classList.add('using-trackpad');
        this.#hasTrackpad = true;
      } else {
        body.classList.add('using-mouse');
      }
    }

    #isPlatformMac() {
      const platform =
        navigator.userAgentData?.platform || navigator.platform || '';
      return /Mac|macOS/i.test(platform);
    }

    #isTrackpadWheel(event) {
      if (!event) {
        return false;
      }

      const { deltaY: eDeltaY, deltaMode: eDeltaMode, wheelDelta } = event;

      // Quick exit: ignore events with no vertical movement
      if (eDeltaY === 0) {
        return false;
      }

      const absY = Math.abs(eDeltaY);

      // 1. Line or Page modes are exclusive to physical mice (Windows/Linux fallbacks)
      if (typeof eDeltaMode === 'number' && eDeltaMode !== DOM_DELTA_PIXEL) {
        return false;
      }

      // 2. Filter out standard fixed-step mouse wheels (typically fixed-step deltas)
      const absWheelDelta = Math.abs(wheelDelta || 0);
      if (
        absY === MOUSE_WHEEL_DELTA_FIXED ||
        absWheelDelta === MOUSE_WHEEL_WHEELDELTA_FIXED
      ) {
        return false;
      }

      // 3. macOS Specific Logic:
      // In our tests, Mac trackpads always produce clean integers (1, 2, 5...),
      // while Apple/Magic mice produce noisy floats (4.0002..., 12.44...) due to acceleration.
      if (this.#isPlatformMac()) {
        return Number.isInteger(eDeltaY) && absY > 0;
      }

      // 4. Universal Fallback (Windows Precision Touchpads / Linux):
      // Small or fractional steps (< fixed mouse wheel step) typically indicate trackpad gliding or inertia.
      return absY < MOUSE_WHEEL_DELTA_FIXED;
    }

    #checkCalibration() {
      if (!this.needsCalibration || this.calibrationActive) {
        return;
      }

      const trigger = () => {
        this.#showCalibration('trackpad');
      };

      if (
        this.#hasTrackpad ||
        document.body.classList.contains('using-trackpad')
      ) {
        trigger();
        return;
      }

      const waitForTrackpad = (e) => {
        const source = this.#determineWheelSource(e);
        if (source !== 'trackpad') {
          return;
        }
        window.removeEventListener('wheel', waitForTrackpad);
        this.#pendingCalibrationListener = null;
        trigger();
      };

      this.#addManagedListener(window, 'wheel', waitForTrackpad, {
        passive: true,
      });
      this.#pendingCalibrationListener = waitForTrackpad;
    }

    #showCalibration(source = 'trackpad') {
      if (source !== 'trackpad' || this.calibrationActive) {
        return;
      }

      if (this.#pendingCalibrationListener) {
        window.removeEventListener('wheel', this.#pendingCalibrationListener);
        this.#pendingCalibrationListener = null;
      }

      this.calibrationSource = source;
      this.calibrationActive = true;
      this.calibrationAccum = 0;
      this.calibrationStep = 0;
      this.calibrationStartTime = window.performance.now();

      const cal = create('div', {
        class: 'spot-calibration',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'spot-calibration-title',
        'aria-describedby': 'spot-calibration-text',
        tabindex: '-1',
      });
      const content = create('div', { class: 'spot-calibration-content' });

      const title = create('h3', { id: 'spot-calibration-title' }, [
        'Trackpad Setup',
      ]);
      const text = create('p', { id: 'spot-calibration-text' }, [
        'Swipe two fingers down to set scroll direction',
      ]);

      const animContainer = create('div', { class: 'trackpad-container' }, [
        create('div', { class: 'trackpad' }, [
          create('div', {
            class: 'finger swipe-down',
            style: { marginLeft: '-22px' },
          }),
          create('div', {
            class: 'finger swipe-down',
            style: { marginLeft: '22px' },
          }),
        ]),
      ]);

      const progressBar = create('div', { class: 'spot-progress-bar' });
      // Remove aria-live to prevent frequent updates from flooding screen readers;
      // announce distributed messages using the global live region.
      const progressValue = create('div', {
        class: 'spot-progress-value',
        'aria-hidden': 'true',
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

      // Focus handling: trap focus inside the calibration dialog and allow keyboard escape to close
      this.#lastFocusedBeforeCalibration = document.activeElement;
      // Add a skip/close button for keyboard users
      const skipBtn = create(
        'button',
        {
          id: 'spot-calibration-skip',
          'aria-label': 'Skip calibration',
          type: 'button',
        },
        ['Skip'],
      );
      // Clicking skip should fully disable the calibration prompt (do not re-open)
      skipBtn.addEventListener('click', () => this.#skipCalibration());
      content.appendChild(skipBtn);

      // Fade in
      requestAnimationFrame(() => {
        cal.classList.add('visible');
        // Focus the dialog
        cal.focus();
        // Install keydown handler
        this.#calibrationKeydownHandler = (ev) =>
          this.#handleCalibrationKeydown(ev);
        // Ensure calibration keydown listener is scoped to the calibration dialog
        this.#addManagedListener(
          cal,
          'keydown',
          this.#calibrationKeydownHandler,
        );
        // Trap focus - store focusable elements
        this.#calibrationFocusable = Array.from(
          cal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (this.#calibrationFocusable && this.#calibrationFocusable.length) {
          this.#calibrationFocusable[0].focus();
        }
      });
    }

    #handleCalibrationWheel(e) {
      if (this.calibrationSource !== 'trackpad') {
        return;
      }

      // Re-verify this is a trackpad event, not mouse
      if (!this.#isTrackpadWheel(e)) {
        return;
      }

      // Startup delay - ignore input for INPUT_DETECTION_DELAY after calibration appears
      if (this.#isCalibrationStartupDelayActive()) {
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

      const progress = Math.min(
        Math.abs(this.calibrationAccum) / CALIBRATION_TARGET,
        1,
      );

      this.#setCalibrationProgress(progress);
    }

    #isCalibrationStartupDelayActive() {
      return (
        this.calibrationStartTime &&
        window.performance.now() - this.calibrationStartTime <
          INPUT_DETECTION_DELAY
      );
    }

    #setCalibrationProgress(progress) {
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
        this.calibrationStartTime = window.performance.now();
        // Reset delay for step 2
        if (this.nodes.calibrationProgress) {
          this.nodes.calibrationProgress.style.width = '0%';
        }
        if (this.nodes.calibrationText) {
          this.nodes.calibrationText.textContent = 'One more time...';
        }
        // Announce step progression to assistive tech via live region
        if (this.liveRegion) {
          this.liveRegion.textContent =
            'Trackpad calibration: step 1 complete. One more time.';
          this.#addTimer(() => {
            if (this.liveRegion) {
              this.liveRegion.textContent = '';
            }
          }, ANNOUNCE_CLEAR_DELAY);
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
      this.calibrationCooldown =
        window.performance.now() + CALIBRATION_COOLDOWN;
      // Announce completion
      if (this.liveRegion) {
        this.liveRegion.textContent = 'Trackpad calibration complete.';
        this.#addTimer(() => {
          if (this.liveRegion) {
            this.liveRegion.textContent = '';
          }
        }, ANNOUNCE_CLEAR_DELAY + COMPLETION_ANNOUNCE_OFFSET);
      }
      // Close calibration
      this.nodes.calibration.classList.remove('visible');
      this.#addTimer(() => {
        this.#cleanupCalibrationHandlers();
        this.#removeCalibrationNodes();
        this.calibrationActive = false;
        this.calibrationSource = null;
      }, CALIBRATION_CLOSE_DELAY);
    }

    /**
     * Removes calibration-related event handlers.
     * Extracted to avoid code duplication between #setCalibrationProgress and #closeCalibration.
     */
    #cleanupCalibrationHandlers() {
      if (this.#calibrationKeydownHandler) {
        try {
          const target =
            this.nodes &&
            this.nodes.calibration &&
            typeof this.nodes.calibration.removeEventListener === 'function'
              ? this.nodes.calibration
              : document;
          target.removeEventListener(
            'keydown',
            this.#calibrationKeydownHandler,
          );
        } catch (err) {
          this._reportError('cleanupCalibrationHandlers', err);
        }
        this.#calibrationKeydownHandler = null;
      }
      this.#calibrationFocusable = null;
    }

    /**
     * Removes calibration DOM nodes and resets related state.
     */
    #removeCalibrationNodes() {
      if (this.nodes.calibration) {
        this.nodes.calibration.remove();
        this.nodes.calibration = null;
        this.nodes.calibrationProgress = null;
        this.nodes.calibrationText = null;
      }
    }

    #handleCalibrationKeydown(ev) {
      if (!this.calibrationActive) {
        return;
      }
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        // Prevent Escape from bubbling to the global key handler and closing the overlay.
        ev.preventDefault();
        ev.stopPropagation();
        // Treat Escape as a 'skip' action – the user intends to dismiss the calibration without completing it
        this.#skipCalibration();
        return;
      }
      if (ev.key !== 'Tab') {
        return;
      }
      const focusables = this.#calibrationFocusable || [];
      if (!focusables.length) {
        return;
      }
      const activeIndex = focusables.indexOf(document.activeElement);
      let nextIndex = 0;
      if (ev.shiftKey) {
        nextIndex = activeIndex > 0 ? activeIndex - 1 : focusables.length - 1;
      } else {
        nextIndex = (activeIndex + 1) % focusables.length;
      }
      ev.preventDefault();
      ev.stopPropagation();
      focusables[nextIndex].focus();
    }

    #closeCalibration() {
      if (!this.calibrationActive || !this.nodes.calibration) {
        return;
      }
      this.nodes.calibration.classList.remove('visible');
      this.#cleanupCalibrationHandlers();
      this.calibrationActive = false;
      this.calibrationSource = null;
      if (this.#pendingCalibrationListener) {
        window.removeEventListener('wheel', this.#pendingCalibrationListener);
        this.#pendingCalibrationListener = null;
      }
      this.#addTimer(() => {
        this.#removeCalibrationNodes();
        if (
          this.#lastFocusedBeforeCalibration &&
          typeof this.#lastFocusedBeforeCalibration.focus === 'function'
        ) {
          this.#lastFocusedBeforeCalibration.focus();
        }
      }, CALIBRATION_CLOSE_DELAY);
    }

    #skipCalibration() {
      // Mark calibration as not required and clear any progress
      this.needsCalibration = false;
      this.calibrationAccum = 0;
      this.calibrationStep = 0;
      this.calibrationStartTime = 0;
      // Prevent immediate re-triggering
      this.calibrationCooldown =
        window.performance.now() + CALIBRATION_COOLDOWN;
      this.#closeCalibration();
    }

    /**
     * Initializes the IntersectionObserver for lazy discovery of galleries.
     * @private
     */
    #initObserver() {
      if (this.#observer || typeof IntersectionObserver !== 'function') {
        return;
      }
      this.#observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = /** @type {Element} */ (entry.target);
              this.scanContainer(el);
              this.#observer.unobserve(el);
            }
          });
        },
        { rootMargin: '500px' },
      );
    }

    /**
     * Scan article and .gallery containers for images lazily.
     * @private
     */
    #scanCollections() {
      this.collections = [];
      this.#scannedImages = new WeakSet();
      this.#trackedElements = new Set();

      const containers = $$('article, .gallery');
      this.#initObserver();

      containers.forEach((container, idx) => {
        this.collections.push({
          id: `spot-${this.#randId()}`,
          container,
          items: [],
          scanned: false,
        });

        // Store internal index for lazy lookup
        container.dataset.spotlightCollectionIndex = String(idx);
        if (this.#observer) {
          this.#observer.observe(container);
        } else {
          this.scanContainer(container);
        }
      });
    }

    /**
     * Scans a specific container for images and initializes its collection.
     * Exposed as public for lazy scanning from click events.
     * @param {Element} container - The container element to scan.
     */
    scanContainer(container) {
      if (!container || !container.dataset) {
        return;
      }
      const idxStr = container.dataset.spotlightCollectionIndex;
      if (idxStr === undefined) {
        return;
      }
      const idx = parseInt(idxStr, 10);
      const collection = this.collections[idx];

      if (!collection || collection.scanned) {
        return;
      }

      const images = $$('img', container);
      images.forEach((img) => {
        // Skip images that belong to nested gallery/article containers.
        if (!this.#isImageInContainer(img, container)) {
          return;
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
          ? this.#sanitizeText(captionEl.textContent || '')
          : this.#sanitizeText(
              img.getAttribute('data-caption') || img.getAttribute('alt') || '',
            );

        const itemIdx = collection.items.length;
        collection.items.push({ src, el: img, caption: captionText });

        img.dataset.spotlightCollection = String(idx);
        img.dataset.spotlightIndex = String(itemIdx);
        img.style.cursor = 'zoom-in';

        this.#scannedImages.add(img);
        this.#trackElement(img);
      });

      collection.scanned = true;
    }

    #randId() {
      return Math.random()
        .toString(ID_BASE)
        .slice(ID_SLICE_START, ID_SLICE_END);
    }

    // Overlay DOM + controls
    #createOverlay() {
      // Root overlay
      const overlay = create('div', {
        id: 'spot-overlay',
        class: CLASS_NAV_HIDDEN,
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
      prevBtn.appendChild(
        createIcon(PATHS_PREV, 'icon-tabler-chevron-compact-left'),
      );

      const canvas = create('div', { id: 'spot-canvas', class: 'spot-canvas' });
      const transform = create('div', {
        id: 'spot-transform',
        class: 'spot-transform',
      });
      const img = create('img', {
        id: 'spot-img',
        draggable: 'false',
      });

      transform.appendChild(img);
      canvas.appendChild(transform);

      const nextBtn = create('button', {
        id: 'spot-next',
        class: 'spot-nav',
        'aria-label': 'Next image',
        'data-dir': '1',
      });
      nextBtn.appendChild(
        createIcon(PATHS_NEXT, 'icon-tabler-chevron-compact-right'),
      );

      stage.appendChild(prevBtn);
      stage.appendChild(canvas);
      stage.appendChild(nextBtn);

      const ui = create('div', {
        id: 'spot-ui',
        class: `spot-ui ${CLASS_UI_HIDDEN}`,
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
      zoomOut.appendChild(createIcon(PATHS_ZOOM_OUT, 'icon-tabler-zoom-out'));

      const zoomDisplay = create(
        'button',
        {
          id: 'spot-zoom-display',
          class: 'spot-btn',
          'aria-label': 'Reset zoom',
        },
        ['100%'],
      );

      const zoomIn = create('button', {
        id: 'spot-zoom-in',
        class: 'spot-btn',
        'aria-label': 'Zoom in',
      });
      zoomIn.appendChild(createIcon(PATHS_ZOOM_IN, 'icon-tabler-zoom-in'));

      const fullscreen = create('button', {
        id: 'spot-fullscreen',
        class: 'spot-btn',
        'aria-label': 'Toggle fullscreen',
      });
      const maximizeIcon = createIcon(
        PATHS_MAXIMIZE,
        'icon-tabler-arrows-maximize',
      );
      const minimizeIcon = createIcon(
        PATHS_MINIMIZE,
        'icon-tabler-arrows-minimize',
      );
      maximizeIcon.style.display = 'block';
      minimizeIcon.style.display = 'none';
      fullscreen.appendChild(maximizeIcon);
      fullscreen.appendChild(minimizeIcon);

      const close = create('button', {
        id: 'spot-close',
        class: 'spot-btn',
        'aria-label': 'Close',
      });
      close.appendChild(createIcon(PATHS_CLOSE, 'icon-tabler-x'));

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

      // Cache fadeable nodes to avoid allocating a new array each render frame
      this.#fadeableNodesCache = [bg, ui, prevBtn, nextBtn, img];

      // track whether pointer is over UI (topbar / caption / buttons / navs)
      this.#pointerOverUi = false;
      // counter to avoid flicker when moving between tracked elements
      this.#pointerOverUiCount = 0;

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
        this.#pointerOverUiCount = (this.#pointerOverUiCount || 0) + 1;
        this.#pointerOverUi = true;
        this.#showUiImmediate();
      };
      const onLeave = () => {
        this.#pointerOverUiCount = Math.max(
          0,
          (this.#pointerOverUiCount || 0) - 1,
        );
        if (this.#pointerOverUiCount === 0) {
          this.#pointerOverUi = false;
          this.#scheduleUiHide();
        }
      };

      trackEls.forEach((el) => {
        this.#addManagedListener(el, 'pointerenter', onEnter);
        this.#addManagedListener(el, 'pointerleave', onLeave);
      });

      // Events
      this.#addManagedListener(this.nodes.closeBtn, 'click', () =>
        this.close(),
      );
      this.#addManagedListener(this.nodes.bg, 'click', () => this.close());
      this.#addManagedListener(this.nodes.prevBtn, 'click', () => this.prev());
      this.#addManagedListener(this.nodes.nextBtn, 'click', () => this.next());
      this.#addManagedListener(this.nodes.zoomIn, 'click', () =>
        this.#zoomBy(ZOOM_FACTOR),
      );
      this.#addManagedListener(this.nodes.zoomOut, 'click', () =>
        this.#zoomBy(1 / ZOOM_FACTOR),
      );
      this.#addManagedListener(this.nodes.zoomDisplay, 'click', () =>
        this.#resetZoom(),
      );
      this.#addManagedListener(this.nodes.fullscreenBtn, 'click', () =>
        this.#toggleFullscreen(),
      );
      this.#addManagedListener(overlay, 'pointermove', () =>
        this.#handleUserActivity(),
      );
      this.#addManagedListener(overlay, 'pointerdown', () =>
        this.#handleUserActivity(),
      );
      this.#addManagedListener(
        overlay,
        'touchstart',
        () => this.#handleUserActivity(),
        { passive: true },
      );
      this.#updateFullscreenButton();

      // Prevent scroll behind overlay
      this.#addManagedListener(
        overlay,
        'wheel',
        (e) => {
          if (this.state.open && this.#isPointerOverStage(e)) {
            e.preventDefault();
          }
        },
        { passive: false },
      );
    }

    // check if event target is inside stage so we can handle wheel pan vs page scroll
    #isPointerOverStage(e) {
      if (!this.#canvasRectCache && this.nodes && this.nodes.canvas) {
        this.#canvasRectCache = this.nodes.canvas.getBoundingClientRect();
      }
      const rect = this.#canvasRectCache;
      if (!rect) {
        return false;
      }
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    }

    #bindGlobalListeners() {
      // Keyboard
      this.#addManagedListener(window, 'keydown', (e) =>
        this.#handleKeydown(e),
      );

      // Wheel to zoom (if pointer over image)
      this.#addManagedListener(
        this.nodes.canvas,
        'wheel',
        (e) => this.#handleWheelEvent(e),
        {
          passive: false,
        },
      );
      // Also listen on overlay for calibration events if they bubble up or occur outside canvas
      this.#addManagedListener(
        this.nodes.overlay,
        'wheel',
        (e) => {
          if (this.calibrationActive) {
            this.#handleCalibrationWheel(e);
          }
        },
        { passive: false },
      );

      // Drag image (pan)
      this.#addManagedListener(this.nodes.imgNode, 'pointerdown', (e) => {
        if (!this.state.open) {
          return;
        }
        this.#handleUserActivity();
        if (!e.isPrimary) {
          return;
        }
        this.#dragPointerId = e.pointerId;
        this.#dragLast.x = e.clientX;
        this.#dragLast.y = e.clientY;
        this.#dragStart = { x: e.clientX, y: e.clientY };
        this.#isVerticalSwipe = false;
        try {
          this.nodes.imgNode.setPointerCapture(e.pointerId);
        } catch (err) {
          this._reportError('setPointerCapture', err);
        }
      });
      this.#addManagedListener(
        window,
        'pointermove',
        (e) => this.#handlePointerMove(e),
        {},
      );
      this.#addManagedListener(
        window,
        'pointerup',
        (e) => {
          if (this.#dragPointerId === e.pointerId) {
            if (this.#isVerticalSwipe) {
              const totalDy = e.clientY - this.#dragStart.y;
              if (totalDy > SWIPE_DOWN_THRESHOLD) {
                this.close();
              } else {
                this.state.translateY = 0;
                this.#constrainAndSync();
                this.#startRenderLoop();
              }
              this.#isVerticalSwipe = false;
            }
            try {
              this.nodes.imgNode.releasePointerCapture(e.pointerId);
            } catch (err) {
              this._reportError('releasePointerCapture', err);
            }
            this.#dragPointerId = null;
          }
        },
        {},
      );

      // Touch swipes: detect horizontal swipe when at default zoom to navigate
      this.touchStart = null;
      this.#addManagedListener(
        this.nodes.canvas,
        'touchstart',
        (e) => {
          if (!this.state.open) {
            return;
          }
          this.#handleUserActivity();
          if (e.touches.length === 1) {
            this.touchStart = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              t: window.performance.now(),
            };
          } else {
            this.touchStart = null;
          }
        },
        { passive: true },
      );
      this.#addManagedListener(
        this.nodes.canvas,
        'touchend',
        (e) => this.#handleTouchEnd(e),
        { passive: true },
      );

      // Pinch-to-zoom using Pointer Events
      this.#bindPinch();

      if (typeof ResizeObserver === 'function') {
        this.#resizeObserver = new ResizeObserver(() => {
          if (this.nodes && this.nodes.canvas) {
            this.#canvasRectCache = this.nodes.canvas.getBoundingClientRect();
          }
          if (!this.state.open) {
            return;
          }
          this.#fitImageToViewport();
          this.#applyTransform({ immediate: true });
        });
        this.#resizeObserver.observe(this.nodes.canvas);
      }

      this.#addManagedListener(
        document,
        'fullscreenchange',
        () => this.#syncFullscreenState(),
        {},
      );

      // Safari Trackpad Gesture (Pinch)
      let gestureLastScale = 1;
      this.#addManagedListener(
        this.nodes.canvas,
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
          this.#isPinching = true;
        },
        { passive: false },
      );
      this.#addManagedListener(
        this.nodes.canvas,
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
            const moderatedDelta = 1 + (delta - 1);
            this.#zoomAtPoint(moderatedDelta, e.clientX, e.clientY);
          }
        },
        { passive: false },
      );
      this.#addManagedListener(
        this.nodes.canvas,
        'gestureend',
        () => {
          if (this.pointers.size > 0) {
            return;
          }
          this.#isPinching = false;
        },
        { passive: false },
      );
    }

    #handleWheelEvent(e) {
      if (!this.state.open) {
        return;
      }

      const source = this.#determineWheelSource(e);
      const isTrackpad = source === 'trackpad';

      if (this.calibrationActive) {
        this.#processCalibrationWheel(e, isTrackpad);
        return;
      }

      // Ignore events during cooldown (e.g. inertia after calibration)
      if (
        this.calibrationCooldown &&
        window.performance.now() < this.calibrationCooldown
      ) {
        return;
      }

      // Mouse wheel handling: ctrl+wheel = zoom, plain wheel = navigate images
      if (!isTrackpad) {
        this.#processNonTrackpadWheel(e);
        return;
      }

      this.#processTrackpadWheel(e, isTrackpad);
    }

    #processCalibrationWheel(e, isTrackpad) {
      if (isTrackpad) {
        this.#handleCalibrationWheel(e);
      }
    }

    /**
     * Processes non-trackpad wheel events
     * @param {WheelEvent} e - The wheel event
     * @private
     */
    #processNonTrackpadWheel(e) {
      e.preventDefault();
      this.#handleUserActivity();
      if (e.ctrlKey) {
        // Ctrl+wheel = zoom
        this.#handleWheelZoom(e, false);
      } else {
        // Plain mouse wheel = navigate images
        this.#handleMouseWheelNavigation(e.deltaY);
      }
    }

    /**
     * Processes trackpad wheel events
     * @param {WheelEvent} e - The wheel event
     * @param {boolean} isTrackpad - Whether the event is from a trackpad
     * @private
     */
    #processTrackpadWheel(e, isTrackpad) {
      if (isTrackpad && this.needsCalibration && !this.calibrationActive) {
        e.preventDefault();
        this.#showCalibration('trackpad');
        return;
      }

      this.#handleTrackpadWheel(e);
    }

    #handleTrackpadWheel(e) {
      const now = window.performance.now();
      const timeSinceLastNav = now - (this.#lastSwipeNavTime || 0);
      const timeSinceLastWheel = now - (this.#lastWheelEventTime || 0);

      // If mode was locked after a swipe navigation, only reset when:
      // 1. Debounce period has passed (500ms since last nav), AND
      // 2. Either there's been a significant pause in wheel events (>150ms)
      //    OR we detect a new gesture start (acceleration in deltaX)
      // This prevents unlocking during continuous fast swiping with brief gaps,
      // but allows rapid intentional swipes.
      if (this.#swipeModeLocked) {
        const absDeltaX = Math.abs(e.deltaX);
        // Check for significant acceleration (new swipe start)
        // We use a threshold of 5 to filter out noise/minor fluctuations in inertia
        const isAcceleration =
          absDeltaX >
          (this.#lastWheelDeltaX || 0) + WHEEL_ACCELERATION_THRESHOLD;

        if (
          timeSinceLastNav >= SWIPE_DEBOUNCE &&
          (timeSinceLastWheel > UNLOCK_WHEEL_GAP || isAcceleration)
        ) {
          this.#swipeModeLocked = false;
          this.#wheelMode = null;
          this.#wheelSwipeAccum = 0;
        }
      }
      this.#lastWheelEventTime = now;
      this.#lastWheelDeltaX = Math.abs(e.deltaX);

      this.#handleUserActivity();
      const mode = this.#detectWheelMode(e);
      e.preventDefault();
      if (mode === 'swipe') {
        this.#handleSwipeWheel(e.deltaX);
      } else {
        this.#handleWheelZoom(e, true);
      }
      this.#scheduleWheelGestureReset();
    }

    #commitSwipeNavigation() {
      this.#lastSwipeNavTime = window.performance.now();
      this.#wheelSwipeAccum = 0;
      // Lock mode to 'zoom' to prevent inertia from re-triggering
      this.#wheelMode = 'zoom';
      this.#swipeModeLocked = true;
    }

    #handleSwipeWheel(deltaX) {
      const now = window.performance.now();
      const timeSinceLastNav = now - (this.#lastSwipeNavTime || 0);

      // During debounce period, don't accumulate
      if (timeSinceLastNav < SWIPE_DEBOUNCE) {
        return;
      }

      let dx = deltaX;
      if (this.invertedScroll) {
        dx = -dx;
      }

      this.#wheelSwipeAccum += dx;
      if (this.#wheelSwipeAccum > TRACKPAD_SWIPE_THRESHOLD) {
        this.#commitSwipeNavigation();
        this.next();
      } else if (this.#wheelSwipeAccum < -TRACKPAD_SWIPE_THRESHOLD) {
        this.#commitSwipeNavigation();
        this.prev();
      }
    }

    /**
     * Handle mouse wheel navigation (for non-trackpad users).
     * Scroll down = next image, scroll up = previous image.
     * Uses debouncing to prevent rapid navigation.
     */
    #handleMouseWheelNavigation(deltaY) {
      // Debounce rapid scrolls
      const now = window.performance.now();
      if (now - (this.#lastMouseWheelNav || 0) < MOUSE_WHEEL_NAV_DEBOUNCE) {
        return;
      }

      // Threshold to filter out tiny movements
      if (Math.abs(deltaY) < MOUSE_WHEEL_NAV_THRESHOLD) {
        return;
      }

      this.#lastMouseWheelNav = now;

      if (deltaY > 0) {
        this.next();
      } else {
        this.prev();
      }
    }

    #detectWheelMode(event) {
      if (this.#wheelMode) {
        return this.#wheelMode;
      }
      if (event.ctrlKey) {
        this.#wheelMode = 'zoom';
        return this.#wheelMode;
      }
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);

      // If both deltas are very small, don't lock mode yet
      if (absX < DELTA_THRESHOLD_MIN && absY < DELTA_THRESHOLD_MIN) {
        return 'zoom'; // Default to zoom/vertical logic for now
      }

      const horizontal =
        (absX > absY * WHEEL_RATIO_THRESHOLD &&
          absX - absY > DELTA_DIFF_THRESHOLD) ||
        (absY < WHEEL_Y_THRESHOLD && absX > WHEEL_Y_THRESHOLD); // Only treat as horizontal if X is significant

      if (horizontal) {
        this.#wheelMode = 'swipe';
      } else if (absY > absX) {
        // Clearly vertical
        this.#wheelMode = 'zoom';
      } else {
        // Ambiguous (e.g. absX > absY but diff is small)
        // Don't lock. Return 'zoom' to prevent default but keep listening.
        return 'zoom';
      }
      return this.#wheelMode;
    }

    #handleWheelZoom(event, isTrackpad) {
      // If pinching via gesture, ignore wheel
      if (this.#isPinching) {
        return;
      }

      // Trackpad pinch (ctrlKey)
      if (event.ctrlKey) {
        const delta = -event.deltaY;
        const effectiveSensitivity = TRACKPAD_PINCH_SENSITIVITY;
        const factor = 1 + delta * effectiveSensitivity;
        this.#zoomAtPoint(factor, event.clientX, event.clientY);
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
          this.#isVerticalSwipe = true;
          this.#swipeIntent = true;
          this.#trackpadSwipeToClose = true; // Track that this is a trackpad-initiated close gesture
          // Use raw delta values - no multiplier for natural feel
          this.state.translateY += deltaY;
          // Prevent moving up (negative translateY) during swipe-to-close
          if (this.state.translateY < 0) {
            this.state.translateY = 0;
          }
          this.#startRenderLoop();
        }
      }
    }

    #scheduleWheelGestureReset() {
      if (this.#wheelSwipeTimer) {
        clearTimeout(this.#wheelSwipeTimer);
        this.#pendingTimers.delete(this.#wheelSwipeTimer);
      }
      this.#wheelSwipeTimer = this.#addTimer(
        () => this.#endWheelGesture(),
        WHEEL_RESET_DELAY,
      );
    }

    #endWheelGesture() {
      if (this.#wheelSwipeTimer) {
        clearTimeout(this.#wheelSwipeTimer);
        this.#pendingTimers.delete(this.#wheelSwipeTimer);
        this.#wheelSwipeTimer = null;
      }
      if (this.#isVerticalSwipe) {
        if (this.state.translateY > SWIPE_DOWN_THRESHOLD) {
          this.close();
        } else {
          this.state.translateY = 0;
          this.#constrainAndSync();
          this.#startRenderLoop();
        }
        this.#isVerticalSwipe = false;
        this.#trackpadSwipeToClose = false;
      }
      this.#wheelSwipeAccum = 0;
      // Don't reset wheelMode if we're in a swipe-locked state (protecting against inertia)
      // The wheel handler will reset it when debounce period ends
      if (!this.#swipeModeLocked) {
        this.#wheelMode = null;
      }
    }

    #handleUserActivity() {
      if (!this.state.open) {
        return;
      }
      this.#showUiImmediate();
      this.#scheduleUiHide();
    }

    #scheduleUiHide() {
      if (this.#uiHideTimer) {
        clearTimeout(this.#uiHideTimer);
        this.#pendingTimers.delete(this.#uiHideTimer);
      }
      this.#uiHideTimer = this.#addTimer(() => {
        if (this.#pointerOverUi) {
          // still over UI — reschedule hide
          this.#scheduleUiHide();
        } else {
          this.#hideUi();
        }
      }, this.#uiHideDelay);
    }

    #showUiImmediate() {
      if (!this.nodes || !this.nodes.ui) {
        return;
      }
      this.nodes.ui.classList.add(CLASS_UI_VISIBLE);
      this.nodes.ui.classList.remove(CLASS_UI_HIDDEN);
      // ensure navs are visible when UI is shown
      if (this.overlay) {
        this.overlay.classList.remove(CLASS_NAV_HIDDEN);
      }
    }

    #hideUi() {
      if (!this.nodes || !this.nodes.ui) {
        return;
      }
      this.nodes.ui.classList.add(CLASS_UI_HIDDEN);
      this.nodes.ui.classList.remove(CLASS_UI_VISIBLE);
      // hide navs with outward animation
      if (this.overlay) {
        this.overlay.classList.add(CLASS_NAV_HIDDEN);
      }
    }

    #toggleFullscreen() {
      this.#handleUserActivity();
      if (this.state.fullscreen) {
        this.#exitFullscreen();
      } else {
        this.#enterFullscreen();
      }
    }

    #enterFullscreen() {
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
      this.#syncFullscreenState();
    }

    #exitFullscreen() {
      if (document.fullscreenElement && document.exitFullscreen) {
        const res = document.exitFullscreen();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
      this.#syncFullscreenState();
    }

    #syncFullscreenState() {
      const isFull = document.fullscreenElement === this.overlay;
      this.state.fullscreen = Boolean(isFull);
      this.#updateFullscreenButton();
    }

    #updateFullscreenButton() {
      const btn = this.nodes && this.nodes.fullscreenBtn;
      if (!btn) {
        return;
      }
      // Swap icon visibility
      const maximizeIcon = btn.querySelector('.icon-tabler-arrows-maximize');
      const minimizeIcon = btn.querySelector('.icon-tabler-arrows-minimize');
      if (maximizeIcon && minimizeIcon) {
        maximizeIcon.style.display = this.state.fullscreen ? 'none' : 'block';
        minimizeIcon.style.display = this.state.fullscreen ? 'block' : 'none';
      }
      btn.setAttribute(
        'aria-label',
        this.state.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
      );
      btn.setAttribute('aria-pressed', String(this.state.fullscreen));
    }

    #animateSlide(direction, cb) {
      this.#handleUserActivity();
      this.#pendingSlideDir = direction || 0;
      if (typeof cb === 'function') {
        cb();
      }
    }

    #playSlideIn(direction) {
      const img = this.nodes && this.nodes.imgNode;
      if (!img) {
        return;
      }
      const dir = direction || 0;
      img.style.transition = 'none';
      if (dir) {
        img.style.transform = `translateX(${dir * SLIDE_OFFSET}px) scale(${SLIDE_SCALE_INITIAL})`;
        img.style.opacity = '0';
      } else {
        img.style.transform = 'translateX(0) scale(1)';
        img.style.opacity = '1';
      }
      requestAnimationFrame(() => {
        img.style.transition = `transform ${SLIDE_IN_DURATION}ms cubic-bezier(0.3, 1, 0.3, 1), opacity ${SLIDE_IN_OPACITY_DURATION}ms ease`;
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

    #bindPinch() {
      let initialDistance = 0;
      const onPointerDown = (e) => {
        if (!this.state.open) {
          return;
        }
        this.#handleUserActivity();
        this.#swipeIntent = false;
        this.#trackpadSwipeToClose = false;
        this.pointers.set(e.pointerId, e);
        // eslint-disable-next-line no-magic-numbers
        if (this.pointers.size === 2) {
          this.#isPinching = true;
          // calculate distance - optimized: use iterator directly instead of Array.from()
          const values = this.pointers.values();
          const p1 = values.next().value;
          const p2 = values.next().value;
          initialDistance = Math.hypot(
            p2.clientX - p1.clientX,
            p2.clientY - p1.clientY,
          );
        }
      };
      const onPointerMove = (e) => {
        if (!this.pointers.has(e.pointerId)) {
          return;
        }
        if (!this.state.open) {
          this.pointers.clear();
          this.#isPinching = false;
          return;
        }
        this.#handleUserActivity();
        this.pointers.set(e.pointerId, e);
        // eslint-disable-next-line no-magic-numbers
        if (this.pointers.size === 2) {
          // Optimized: use iterator directly instead of Array.from()
          const values = this.pointers.values();
          const p1 = values.next().value;
          const p2 = values.next().value;
          const currentDistance = Math.hypot(
            p2.clientX - p1.clientX,
            p2.clientY - p1.clientY,
          );
          if (initialDistance > 0) {
            const delta = currentDistance / initialDistance;
            initialDistance = currentDistance; // Update for next frame
            if (delta !== 1) {
              const sensitivity =
                e.pointerType === 'touch' ? PINCH_SENSITIVITY_TOUCH : 1;
              const moderatedDelta = 1 + (delta - 1) * sensitivity;
              const cx = (p1.clientX + p2.clientX) * CENTER_OFFSET;
              const cy = (p1.clientY + p2.clientY) * CENTER_OFFSET;
              this.#zoomAtPoint(moderatedDelta, cx, cy);
            }
          }
        }
      };
      const onPointerUp = (e) => {
        this.pointers.delete(e.pointerId);
        // eslint-disable-next-line no-magic-numbers
        if (this.pointers.size < 2) {
          this.#isPinching = false;
          initialDistance = 0;
        }
      };
      // Attach to image node
      this.#addManagedListener(this.nodes.canvas, 'pointerdown', onPointerDown);
      this.#addManagedListener(window, 'pointermove', onPointerMove);
      this.#addManagedListener(window, 'pointerup', onPointerUp);
      this.#addManagedListener(window, 'pointercancel', onPointerUp);
    }

    /**
     * Opens a collection in the spotlight viewer.
     * @param {number} collectionIndex - Index of the collection to open
     * @param {number} [itemIndex=0] - Index of the item within the collection
     */
    openCollection(collectionIndex, itemIndex = 0) {
      const safeCollectionIndex =
        this.#sanitizeCollectionIndex(collectionIndex);
      const safeItemIndex = this.#sanitizeCollectionIndex(itemIndex);

      if (safeCollectionIndex === null) {
        this._reportError(
          'openCollection.collectionIndex',
          new TypeError('collectionIndex must be a non-negative integer'),
        );
        return;
      }
      if (safeItemIndex === null) {
        this._reportError(
          'openCollection.itemIndex',
          new TypeError('itemIndex must be a non-negative integer'),
        );
        return;
      }

      const collection = this.collections[safeCollectionIndex];
      if (!collection) {
        return;
      }

      // If the container has not been scanned yet (lazy loading), scan it now.
      if (!collection.scanned) {
        this.scanContainer(collection.container);
      }

      if (!collection.items[safeItemIndex]) {
        return;
      }

      this.state.open = true;
      this.state.collectionIndex = safeCollectionIndex;
      this.state.itemIndex = safeItemIndex;
      // UI is hidden by default, will show on user activity
      this.#showOverlay();
      this.#checkCalibration();
      this.#loadItem();
    }

    #showOverlay() {
      this.overlay.style.display = 'block';
      this.#lastFocused = document.activeElement;

      requestAnimationFrame(() => {
        this.overlay.classList.add(CLASS_OPEN);
        this.overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        this.nodes.shell.focus();

        if (this.#uiShowTimer) {
          clearTimeout(this.#uiShowTimer);
          this.#pendingTimers.delete(this.#uiShowTimer);
          this.#uiShowTimer = null;
        }

        const handleTransitionEnd = (e) => {
          if (e.target !== this.overlay) {
            return;
          }
          this.overlay.removeEventListener(
            'transitionend',
            handleTransitionEnd,
          );
          if (!this.state.open) {
            return;
          }

          this.#showUiImmediate();
          this.#scheduleUiHide();
        };

        this.overlay.addEventListener('transitionend', handleTransitionEnd);
      });
    }

    /**
     * Completely destroys the Spotlight instance and cleans up event listeners.
     */
    destroy() {
      this.close();
      if (this.#trackpadResetTimer !== null) {
        clearTimeout(this.#trackpadResetTimer);
        this.#trackpadResetTimer = null;
      }
      if (this.#abortController) {
        this.#abortController.abort();
      }
      this.#cleanupManagedListeners();
      uninitAuto();

      // Clean up manually attached listeners and DOM pollution
      this.#trackedElements.forEach((ref) => {
        const el = ref.deref();
        if (!el) {
          return;
        }

        // Remove listener
        if (this.#attachedListeners.has(el)) {
          el.removeEventListener('click', this.#attachedListeners.get(el));
        }

        // Clean up datasets and cursor
        delete el.dataset.spotlightCollection;
        delete el.dataset.spotlightIndex;
        if (el.style.cursor === 'zoom-in') {
          el.style.cursor = '';
        }
      });

      this.#trackedElements.clear();
      this.#scannedImages = new WeakSet();
      this.#attachedListeners = new WeakMap();
      if (this.#observer) {
        this.#observer.disconnect();
        this.#observer = null;
      }
      if (this.#resizeObserver) {
        this.#resizeObserver.disconnect();
        this.#resizeObserver = null;
      }
      this.#canvasRectCache = null;
      // Clear all pending timers
      this.#pendingTimers.forEach((id) => clearTimeout(id));
      this.#pendingTimers.clear();
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }

      this.#pendingCalibrationListener = null;
      this.#calibrationKeydownHandler = null;
      this.#calibrationFocusable = null;
      this.#lastFocusedBeforeCalibration = null;
      this.#lastFocused = null;
      this.#uiShowTimer = null;
      this.#uiHideTimer = null;
      this.#wheelSwipeTimer = null;
      if (this.#weakRefCleanupTimer) {
        clearTimeout(this.#weakRefCleanupTimer);
        this.#weakRefCleanupTimer = null;
      }
      if (__spotlight_instance === this) {
        __spotlight_instance = null;
      }
      this.liveRegion = null;
      this.#fadeableNodesCache = null;
      this.overlay = null;
      this.nodes = null;
      this.#cssInjected = false;
    }

    /**
     * Closes the spotlight viewer and restores the page state.
     * Handles cleanup of animations, timers, and calibration UI.
     */
    close() {
      if (!this.state.open) {
        return;
      }
      const overlay = this.overlay;
      const lastFocused = this.#lastFocused;
      this.overlay.classList.remove(CLASS_OPEN);
      this.overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      this.state.open = false;
      this.state.fullscreen = false;
      this.#exitFullscreen();
      this.#updateFullscreenButton();
      if (this.#uiHideTimer) {
        clearTimeout(this.#uiHideTimer);
        this.#pendingTimers.delete(this.#uiHideTimer);
      }
      if (this.#wheelSwipeTimer) {
        clearTimeout(this.#wheelSwipeTimer);
        this.#pendingTimers.delete(this.#wheelSwipeTimer);
      }
      if (this.#uiShowTimer) {
        clearTimeout(this.#uiShowTimer);
        this.#pendingTimers.delete(this.#uiShowTimer);
      }
      this.#wheelSwipeAccum = 0;
      this.#wheelMode = null;
      this.#lastSwipeNavTime = 0;
      this.#swipeModeLocked = false;
      this.#lastWheelDeltaX = 0;
      this.#pendingSlideDir = 0;
      this.#hideUi();
      if (this.#pendingCalibrationListener) {
        window.removeEventListener('wheel', this.#pendingCalibrationListener);
        this.#pendingCalibrationListener = null;
      }
      if (this.calibrationActive && this.nodes.calibration) {
        this.#cleanupCalibrationHandlers();
        this.#removeCalibrationNodes();
        this.calibrationActive = false;
        this.calibrationSource = null;
      }
      // small delay to allow animation
      this.#addTimer(() => {
        if (!this.state.open && overlay) {
          overlay.style.display = 'none';
        }
        if (lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
        }
      }, CLOSE_DELAY);
    }

    /**
     * Navigates to the previous image in the current collection.
     */
    prev() {
      const currentCollection = this.collections[this.state.collectionIndex];
      if (!currentCollection || this.state.itemIndex <= 0) {
        return;
      }
      this.state.itemIndex--;
      this.#animateSlide(-1, () => this.#loadItem());
    }

    /**
     * Navigates to the next image in the current collection.
     */
    next() {
      const currentCollection = this.collections[this.state.collectionIndex];
      if (
        !currentCollection ||
        this.state.itemIndex >= currentCollection.items.length - 1
      ) {
        return;
      }
      this.state.itemIndex++;
      this.#animateSlide(1, () => this.#loadItem());
    }

    #updateNavVisibility() {
      const currentCollection = this.collections[this.state.collectionIndex];
      if (!currentCollection) {
        return;
      }
      const count = currentCollection.items.length;
      const index = this.state.itemIndex;

      if (this.nodes.prevBtn) {
        this.nodes.prevBtn.style.display = index > 0 ? '' : 'none';
      }
      if (this.nodes.nextBtn) {
        this.nodes.nextBtn.style.display = index < count - 1 ? '' : 'none';
      }
    }

    #loadItem() {
      const currentCollection = this.collections[this.state.collectionIndex];
      if (!currentCollection) {
        return;
      }
      const item = currentCollection.items[this.state.itemIndex];
      if (!item) {
        return;
      }

      // Capture requested slide direction immediately so rapid successive
      // navigations do not lose the intended animation direction.
      const slideDir = this.#pendingSlideDir || 0;
      this.#pendingSlideDir = 0;

      this.#resetRenderState();
      this.#updateNavVisibility();

      // show spinner while loading
      this.nodes.imgNode.style.opacity = '0';
      this.nodes.imgNode.src = '';
      this.nodes.counter.textContent = `${this.state.itemIndex + 1} / ${
        currentCollection.items.length
      }`;
      this.#updateCaption(item.caption);
      if (this.liveRegion) {
        this.liveRegion.textContent = `Image ${this.state.itemIndex + 1} of ${
          currentCollection.items.length
        }${item.caption ? ': ' + item.caption : ''}`;
      }

      const safeSrc = this.#getSafeImageUrl(item.src);
      if (!safeSrc) {
        this.#updateCaption('Invalid image URL');
        if (this.liveRegion) {
          this.liveRegion.textContent = 'Invalid image URL blocked for safety.';
        }
        return;
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
          this.#fitImageToViewport();
          this.#applyTransform({ immediate: true });
          this.#playSlideIn(slideDir);
        });
      };

      node.onerror = () => {
        node.src = '';
        this.#updateCaption('Failed to load image');
        node.style.opacity = '1';
      };

      // Trigger load
      node.src = safeSrc;
      if (/\.svg($|\?)/i.test(safeSrc)) {
        node.classList.add('spot-svg');
        // Security: SVG files should be served with strict CSP headers.
        // For additional protection, consider:
        // 1. Using CSP: img-src 'self' data:;
        // 2. Sanitizing SVG content server-side before serving
        // 3. Converting SVG to PNG/CBW on the server
      } else {
        node.classList.remove('spot-svg');
      }
      if (node.complete && node.naturalWidth) {
        // cached image won't fire onload
        if (typeof node.onload === 'function') {
          node.onload();
        }
      }
    }

    #updateCaption(text) {
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

    #resetRenderState() {
      this.state.scale = 1;
      this.state.baseScale = 1;
      this.state.translateX = 0;
      this.state.translateY = 0;
      this.renderState.scale = 1;
      this.renderState.translateX = 0;
      this.renderState.translateY = 0;
      this.#renderActive = false;
      this.#resetNodeOpacities();
      if (this.#rafId) {
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
      }
    }

    get #fadeableNodes() {
      return this.#fadeableNodesCache || [];
    }

    /**
     * Resets opacity on all fadeable UI nodes to their default CSS values.
     */
    #resetNodeOpacities() {
      this.#fadeableNodes.forEach((node) => {
        if (node) {
          node.style.opacity = '';
        }
      });
    }

    #startRenderLoop() {
      if (this.#rafId) {
        return;
      }
      this.#renderActive = true;
      this.#lastRenderTime = window.performance.now();
      this.#renderLoop();
    }

    #renderLoop() {
      if (!this.#renderActive || !this.state.open) {
        this.#rafId = null;
        return;
      }

      const now = window.performance.now();
      const dt =
        Math.min(now - (this.#lastRenderTime || now), MAX_FRAME_DT) /
        MS_PER_SECOND;
      this.#lastRenderTime = now;

      const { scale, translateX, translateY } = this.state;
      const renderState = this.renderState;

      // Time-based lerp: 1 - exp(-decay * dt)
      // Higher decay = snappier animation, lower = smoother
      const f = 1 - Math.exp(-LERP_DECAY * dt);

      renderState.scale += (scale - renderState.scale) * f;
      renderState.translateX += (translateX - renderState.translateX) * f;
      renderState.translateY += (translateY - renderState.translateY) * f;

      this.#checkConvergence(scale, translateX, translateY, renderState);

      // Apply
      if (this.nodes.transform) {
        this.nodes.transform.style.transition = 'none';
        this.nodes.transform.style.transform = `translate(${renderState.translateX}px, ${renderState.translateY}px) scale(${renderState.scale})`;
        this.#updateZoomDisplay(renderState.scale);

        this.#updateSwipeAnimation(renderState.translateY);

        const img = this.nodes.imgNode;
        img.style.cursor =
          Math.abs(renderState.scale - (this.state.baseScale || 1)) >
            CURSOR_SCALE_THRESHOLD ||
          Math.abs(renderState.translateX) > 1 ||
          Math.abs(renderState.translateY) > 1
            ? 'grab'
            : 'zoom-out';
      }

      if (this.#renderActive) {
        // Add DoS protection: limit render loop execution frequency
        // Use setTimeout with minimum delay to prevent excessive CPU usage
        this.#rafId = requestAnimationFrame(() => this.#renderLoop());
      } else {
        this.#rafId = null;
      }
    }

    #updateSwipeAnimation(translateY) {
      // For trackpad swipes, allow animation at any zoom level (trackpad uses different gesture for pan)
      // For touch swipes, only animate when zoomed out
      const isZoomedOut =
        Math.abs(this.state.scale - (this.state.baseScale || 1)) <
        PAN_THRESHOLD;

      // Allow animation if: zoomed out OR it's a trackpad-initiated swipe
      const allowAnimation = isZoomedOut || this.#trackpadSwipeToClose;

      if (
        translateY > 0 &&
        this.state.open &&
        allowAnimation &&
        this.#swipeIntent
      ) {
        const progress = Math.min(
          1,
          Math.abs(translateY) / SWIPE_CLOSE_DIVISOR,
        );
        this.#setNodeOpacities(1 - progress);
      } else {
        this.#resetNodeOpacities();
      }
    }

    /**
     * Sets opacity on all fadeable UI nodes.
     * @param {number} opacity - Value between 0 and 1
     */
    #setNodeOpacities(opacity) {
      const opacityStr = String(opacity);
      this.#fadeableNodes.forEach((node) => {
        if (node) {
          node.style.opacity = opacityStr;
        }
      });
    }

    #checkConvergence(scale, translateX, translateY, renderState) {
      if (
        Math.abs(scale - renderState.scale) < CONVERGENCE_SCALE &&
        Math.abs(translateX - renderState.translateX) < CONVERGENCE_TRANSLATE &&
        Math.abs(translateY - renderState.translateY) < CONVERGENCE_TRANSLATE
      ) {
        renderState.scale = scale;
        renderState.translateX = translateX;
        renderState.translateY = translateY;
        this.#renderActive = false;
        // Reset swipe intent when animation settles (e.g. bounce back complete)
        if (Math.abs(translateY) < 1) {
          this.#swipeIntent = false;
        }
      }
    }

    #fitImageToViewport() {
      const img = this.nodes && this.nodes.imgNode;
      if (!img) {
        return;
      }
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const intrinsicWidth = img.naturalWidth || img.width || img.clientWidth;
      const intrinsicHeight =
        img.naturalHeight || img.height || img.clientHeight;
      if (!intrinsicWidth || !intrinsicHeight) {
        return;
      }

      const scaleW = viewportWidth / intrinsicWidth;
      const scaleH = viewportHeight / intrinsicHeight;
      const viewportLandscape = viewportWidth >= viewportHeight;

      let baseScale;

      if (viewportLandscape) {
        // Desktop / Landscape
        // Use Contain logic (fit fully inside), but cap at 1.0 to avoid upscaling small images by default.
        baseScale = Math.min(scaleW, scaleH, 1);
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

    #applyTransform(options = {}) {
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
      this.#updateZoomDisplay(scale);

      const img = this.nodes.imgNode;
      img.style.cursor =
        Math.abs(scale - (this.state.baseScale || 1)) >
          CURSOR_SCALE_THRESHOLD ||
        Math.abs(translateX) > 1 ||
        Math.abs(translateY) > 1
          ? 'grab'
          : 'zoom-out';
    }

    #updateZoomDisplay(scale) {
      if (!this.nodes || !this.nodes.zoomDisplay) {
        return;
      }
      const pct = Math.round((scale || 1) * PERCENTAGE);
      this.nodes.zoomDisplay.textContent = `${pct}%`;
      this.nodes.zoomDisplay.title = `Reset zoom (${pct}%)`;
    }

    /**
     * Zooms the image by a given factor, centered on the viewport.
     * @param {number} factor - Zoom multiplier (>1 zooms in, <1 zooms out)
     */
    #zoomBy(factor) {
      this.#handleUserActivity();
      this.state.scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, this.state.scale * factor),
      );
      this.#startRenderLoop();
    }

    /**
     * Resets the zoom to the base scale and centers the image.
     */
    #resetZoom() {
      this.#handleUserActivity();
      this.state.scale = this.state.baseScale || 1;
      this.state.translateX = 0;
      this.state.translateY = 0;
      this.#startRenderLoop();
    }

    /**
     * Constrains the image translation to keep at least MIN_VISIBLE_RATIO visible.
     * Prevents the image from being panned completely out of view.
     */
    #constrainAndSync() {
      const { naturalWidth, naturalHeight } = this.nodes.imgNode;
      const { clientWidth, clientHeight } = this.nodes.canvas;
      const currentW = naturalWidth * this.state.scale;
      const currentH = naturalHeight * this.state.scale;

      const limitX =
        clientWidth * CENTER_OFFSET +
        currentW * (CENTER_OFFSET - MIN_VISIBLE_RATIO);
      const limitY =
        clientHeight * CENTER_OFFSET +
        currentH * (CENTER_OFFSET - MIN_VISIBLE_RATIO);

      this.state.translateX = Math.min(
        limitX,
        Math.max(-limitX, this.state.translateX),
      );
      this.state.translateY = Math.min(
        limitY,
        Math.max(-limitY, this.state.translateY),
      );
    }

    /**
     * Zooms the image while keeping a specific point anchored under the cursor.
     * Used for pinch-to-zoom and scroll-wheel zoom gestures.
     * @param {number} factor - Zoom multiplier
     * @param {number} clientX - X coordinate of the anchor point
     * @param {number} clientY - Y coordinate of the anchor point
     */
    #zoomAtPoint(factor, clientX, clientY) {
      this.#handleUserActivity();
      this.#swipeIntent = false;
      this.#trackpadSwipeToClose = false;
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
        Math.max(MIN_SCALE, prevTargetScale * factor),
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

      this.#constrainAndSync();
      this.#startRenderLoop();
    }

    // Programmatic helper to attach to external nodes (if needed)
    attachImage(imgEl, collectionIndex, itemIndex) {
      if (!(imgEl instanceof window.HTMLImageElement)) {
        this._reportError(
          'attachImage.imgEl',
          new TypeError('imgEl must be an HTMLImageElement'),
        );
        return;
      }
      const safeCollectionIndex =
        this.#sanitizeCollectionIndex(collectionIndex);
      const safeItemIndex = this.#sanitizeCollectionIndex(itemIndex);
      if (safeCollectionIndex === null || safeItemIndex === null) {
        this._reportError(
          'attachImage.indices',
          new TypeError(
            'collectionIndex and itemIndex must be non-negative integers',
          ),
        );
        return;
      }

      // Track the image for later cleanup
      this.#scannedImages.add(imgEl);
      this.#trackElement(imgEl);

      imgEl.dataset.spotlightCollection = String(safeCollectionIndex);
      imgEl.dataset.spotlightIndex = String(safeItemIndex);
      imgEl.style.cursor = 'zoom-in';

      // Store and add listener
      const listener = (e) => {
        e.preventDefault();
        this.openCollection(safeCollectionIndex, safeItemIndex);
      };

      // Clean up previous listener on the same element if it exists
      if (this.#attachedListeners.has(imgEl)) {
        imgEl.removeEventListener('click', this.#attachedListeners.get(imgEl));
      }

      this.#attachedListeners.set(imgEl, listener);
      imgEl.addEventListener('click', listener);
    }

    /**
     * Internal: Track an element using a WeakRef for later cleanup.
     * @param {Element} el
     */
    #trackElement(el) {
      if (!el) {
        return;
      }
      this.#trackedElements.add(new WeakRef(el));
    }

    /**
     * Cleans up expired WeakRefs from the tracked elements set
     * @private
     */
    #cleanupExpiredWeakRefs() {
      if (typeof WeakRef !== 'function') {
        return;
      }

      // Since we can't directly iterate WeakRefs, we need to recreate the set
      // filtering out expired references
      const validRefs = [];
      for (const ref of this.#trackedElements) {
        if (ref instanceof WeakRef) {
          // Try to dereference - if it returns undefined, the object has been garbage collected
          if (ref.deref() !== undefined) {
            validRefs.push(ref);
          }
        } else {
          // Non-WeakRef items are always valid
          validRefs.push(ref);
        }
      }

      // Replace the set with only valid references
      this.#trackedElements = new Set(validRefs);
    }

    /**
     * Periodically cleans up expired WeakRefs to prevent accumulation
     * @private
     */
    #scheduleWeakRefCleanup() {
      // Schedule cleanup every 30 seconds to avoid constant overhead
      // but still prevent accumulation over time
      if (this.#weakRefCleanupTimer) {
        clearTimeout(this.#weakRefCleanupTimer);
        this.#pendingTimers.delete(this.#weakRefCleanupTimer);
      }

      this.#weakRefCleanupTimer = this.#addTimer(() => {
        this.#cleanupExpiredWeakRefs();
        // Continue scheduling cleanup
        this.#scheduleWeakRefCleanup();
      }, WEAKREF_CLEANUP_INTERVAL); // 30 seconds
    }

    /**
     * Checks if styles are already injected
     * @returns {boolean} Whether styles are already present
     * @private
     */
    #areStylesInjected() {
      if (this.#cssInjected) {
        const existing = document.getElementById('spotlight-styles');
        if (existing && existing.tagName === 'STYLE') {
          return true;
        }
      }
      return false;
    }

    #injectStyles() {
      if (this.#areStylesInjected()) {
        return;
      }

      if (!document.head) {
        this._reportError(
          'injectStyles.noHead',
          new Error('document.head is not available'),
        );
        return;
      }

      try {
        const style = this.#createStyledElement(this.#getCSSContent());
        document.head.appendChild(style);

        // Store reference to prevent recreation
        this.#cssInjected = true;
      } catch (err) {
        this.#handleStyleInjectionError(err);
      }
    }

    /**
     * Gets the CSS content for injection
     * @returns {string} The CSS content
     * @private
     */
    #getCSSContent() {
      return `:root {
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
      #spot-overlay { all: initial; display:none; position:fixed; inset:0; z-index:2147483646; font-family:var(--spot-font); -webkit-font-smoothing:antialiased; opacity:0; transition:opacity var(--spot-anim); touch-action:none; direction: ltr; }
      #spot-overlay, #spot-overlay * { -webkit-user-select:none; user-select:none; }
      #spot-overlay.spot-open { pointer-events:auto; opacity:1; }
      #spot-bg { position:fixed; inset:0; background:var(--spot-bg); transition:opacity var(--spot-anim); opacity:0; }
      #spot-shell { position:fixed; inset:0; pointer-events:none; opacity:0; transform:scale(0.9); transition:opacity var(--spot-anim), transform var(--spot-anim); }
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
      .spot-btn {
        width:50px;
        height:50px;
        border-radius:6px;
        border:none;
        background:transparent;
        color:var(--spot-ui-fg);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
        font-weight:600;
        cursor:pointer;
        transition:background 150ms ease;
        /* Ensure zoom percentage doesn't shift when numbers change */
        font-variant-numeric: tabular-nums;
        -webkit-font-feature-settings: "tnum" 1;
        font-feature-settings: "tnum" 1;
      }
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
        .spot-topbar { gap:10px; height:75px; padding: 0 24px;}
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
      .spot-calibration p { margin:0; opacity:0.8;}
      
      /* Trackpad Animation Styles */
      .trackpad-container { transform: scale(0.6); margin: 0 auto; width: 400px; }
      .trackpad { width: 400px; height: 250px; background: #ffffff; border-radius: 20px; border: 2px solid #ccc; position: relative; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin: 0 auto; }
      .finger { width: 32px; height: 32px; background: #007AFF; box-shadow: 0 2px 10px rgba(0, 122, 255, 0.4); border-radius: 50%; position: absolute; }
      
      .spot-progress-bar { width: 100%; height: 9px; background: rgba(128,128,128,0.2); border-radius: 6px; overflow: hidden; }
      .spot-progress-value { width: 0%; height: 100%; background: #007AFF; transition: width 0.1s linear; }

      /* Calibration skip button */
      #spot-calibration-skip { position: absolute; top: 15px; right: 20px; opacity: 0.25; transition: opacity 150ms ease; z-index: 10; cursor: pointer; background: transparent; border: none; padding: 0; margin: 0; color: var(--spot-ui-fg); font-weight: 600; font-size: 14px; }
      #spot-calibration-skip:hover { opacity: 1; }
      /* Provide a visible focus ring for keyboard users (WCAG 2.4.7) */
      #spot-calibration-skip:focus { outline: none; }
      #spot-calibration-skip:focus-visible { outline: 2px solid var(--spot-ui-fg); outline-offset: 2px; border-radius: 3px; }
      #spot-calibration-skip:active { transform: scale(0.98); }

      /* Animations */
      .finger.swipe-down { left: 50%; transform: translateX(-50%); animation: swipeDown 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      @keyframes swipeDown { 0% { top: 40px; opacity: 0; transform: translateX(-50%) scale(0.8); } 10% { opacity: 1; transform: translateX(-50%) scale(1); } 60% { top: 180px; opacity: 1; transform: translateX(-50%) scale(1); box-shadow: 0 2px 10px rgba(0, 122, 255, 0.4); } 75% { top: 180px; opacity: 0; transform: translateX(-50%) scale(1.5); box-shadow: 0 0 0 20px rgba(0, 122, 255, 0); } 100% { top: 180px; opacity: 0; } }`;
    }

    #handleKeydown(e) {
      if (!this.state.open) {
        return;
      }

      if (this.#shouldIgnoreKeydown(e)) {
        return;
      }

      this.#handleUserActivity();

      const code = e.code;
      const key = e.key;
      const kLower = key.toLowerCase();

      if (code === 'Escape' || key === 'Escape' || key === 'Esc') {
        this.close();
        return;
      }

      if (this.#handleNavigationKey(code, kLower)) {
        return;
      }
      if (this.#handleZoomKey(code, key)) {
        return;
      }

      if (['Digit0', 'Numpad0'].includes(code) || ['0', ')'].includes(key)) {
        this.#resetZoom();
        return;
      }

      // Fullscreen
      if (code === 'KeyF' || kLower === 'f') {
        this.#toggleFullscreen();
      }
    }

    #shouldIgnoreKeydown(e) {
      if (!e) {
        return true;
      }
      if (this.#isEditableTarget(e.target)) {
        return true;
      }
      return Boolean(e.ctrlKey || e.altKey || e.metaKey);
    }

    #handleNavigationKey(code, kLower) {
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

    #handleZoomKey(code, key) {
      if (['Equal', 'NumpadAdd'].includes(code) || ['+', '='].includes(key)) {
        this.#zoomBy(ZOOM_FACTOR);
        return true;
      }
      if (
        ['Minus', 'NumpadSubtract'].includes(code) ||
        ['-', '_'].includes(key)
      ) {
        this.#zoomBy(1 / ZOOM_FACTOR);
        return true;
      }
      return false;
    }

    #handleTouchEnd(e) {
      if (!this.state.open || !this.touchStart) {
        return;
      }
      this.#handleUserActivity();
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
      const dt = window.performance.now() - this.touchStart.t;
      this.touchStart = null;

      if (this.#isValidSwipe(dx, dy, dt)) {
        if (dx < 0) {
          this.next();
        } else {
          this.prev();
        }
      }
    }

    /**
     * Creates and configures the style element with nonce if needed
     * @param {string} cssContent - The CSS content to inject
     * @returns {HTMLStyleElement} The configured style element
     * @private
     */
    #createStyledElement(cssContent) {
      const style = create('style', {
        id: 'spotlight-styles',
        type: 'text/css',
      });

      const config =
        (window.Spotlight && window.Spotlight.config) || DEFAULT_CONFIG;
      const autoNonceEl = document.querySelector('script[nonce]');
      const autoNonce = autoNonceEl && autoNonceEl.nonce;
      const finalNonce = config.cspNonce || autoNonce;
      if (finalNonce) {
        style.setAttribute('nonce', finalNonce);
      }

      // Use a TextNode for better performance
      const textNode = document.createTextNode(cssContent);
      style.appendChild(textNode);

      return style;
    }

    /**
     * Handles error during style injection
     * @param {Error} err - The error that occurred
     * @private
     */
    #handleStyleInjectionError(err) {
      this._reportError('injectStyles.append', err);
    }

    #handlePointerMove(e) {
      if (this.#dragPointerId !== e.pointerId) {
        return;
      }

      this.#handleUserActivity();

      // If pinching, cancel drag to avoid conflict
      if (this.#isPinching) {
        this.#dragPointerId = null;
        return;
      }

      // Check for swipe down start
      if (!this.#isVerticalSwipe && this.#dragStart) {
        this.#checkForVerticalSwipe(e);
      }

      if (this.#isVerticalSwipe) {
        const dy = e.clientY - this.#dragLast.y;
        this.state.translateY += dy;
        this.#dragLast.x = e.clientX;
        this.#dragLast.y = e.clientY;
        this.#startRenderLoop();
        return;
      }

      // Disable pan without zoom on mobile/touch
      if (
        e.pointerType === 'touch' &&
        Math.abs(this.state.scale - (this.state.baseScale || 1)) < PAN_THRESHOLD
      ) {
        return;
      }

      const dx = e.clientX - this.#dragLast.x;
      const dy = e.clientY - this.#dragLast.y;
      this.#dragLast.x = e.clientX;
      this.#dragLast.y = e.clientY;
      this.state.translateX += dx;
      this.state.translateY += dy;
      this.#constrainAndSync();
      this.#startRenderLoop();
    }

    #isValidSwipe(dx, dy, dt) {
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

    #checkForVerticalSwipe(e) {
      // Only allow swipe-to-close on touch devices
      if (e.pointerType !== 'touch') {
        // For mouse/pen, treat as normal pan (fall through)
        return;
      }

      const totalDy = e.clientY - this.#dragStart.y;
      const totalDx = e.clientX - this.#dragStart.x;
      const isZoomedOut =
        Math.abs(this.state.scale - (this.state.baseScale || 1)) <
        PAN_THRESHOLD;

      if (
        isZoomedOut &&
        totalDy > 0 &&
        Math.abs(totalDy) > Math.abs(totalDx) &&
        totalDy > SWIPE_THRESHOLD_PX
      ) {
        this.#isVerticalSwipe = true;
        this.#swipeIntent = true;
      }
    }
  }

  let autoHandler = null;
  let autoRoots = [];

  const MAX_AUTO_SELECTOR_LENGTH = 200;

  function getAutoRootSelector() {
    const config =
      (window.Spotlight && window.Spotlight.config) || DEFAULT_CONFIG;
    let sel = String(config.autoInitRootSelector || '').trim();

    // Validation: prevent dangerous or overly broad selectors
    if (!sel || sel.length > MAX_AUTO_SELECTOR_LENGTH || sel === '*') {
      sel = DEFAULT_CONFIG.autoInitRootSelector;
    }
    return sel;
  }

  function attachAutoHandlers(handler) {
    const selector = getAutoRootSelector();
    let roots = [];

    try {
      roots = $$(selector).filter(Boolean);
    } catch (err) {
      if (__spotlight_instance) {
        __spotlight_instance._reportError('attachAutoHandlers', err);
      }
      // Fallback on error
      try {
        roots = $$(DEFAULT_CONFIG.autoInitRootSelector).filter(Boolean);
      } catch (fallbackErr) {
        if (
          __spotlight_instance &&
          typeof __spotlight_instance._reportError === 'function'
        ) {
          __spotlight_instance._reportError(
            'attachAutoHandlers.fallback',
            fallbackErr,
          );
        }
      }
    }

    // Fallback keeps behavior when no roots exist at init time.
    if (!roots.length) {
      window.addEventListener('click', handler);
      autoRoots = [window];
      return;
    }

    roots.forEach((root) => root.addEventListener('click', handler));
    autoRoots = roots;
  }

  function detachAutoHandlers(handler) {
    if (!autoRoots.length) {
      window.removeEventListener('click', handler);
      return;
    }
    autoRoots.forEach((root) => {
      if (root && typeof root.removeEventListener === 'function') {
        root.removeEventListener('click', handler);
      }
    });
    autoRoots = [];
  }

  /**
   * Internal helper to initialize the global click listener for auto-detection.
   */
  function initAuto() {
    if (autoHandler) {
      return;
    }

    autoHandler = (e) => {
      if (!e || !e.target || typeof e.target.closest !== 'function') {
        return;
      }

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

      // If the image hasn't been scanned (lazy loading), scan its container now.
      if (!target.dataset.spotlightCollection) {
        inst.scanContainer(container);
      }

      const collIndex = parseInt(target.dataset.spotlightCollection || '0', 10);
      const itemIndex = parseInt(target.dataset.spotlightIndex || '0', 10);
      inst.openCollection(collIndex, itemIndex);
    };

    attachAutoHandlers(autoHandler);
  }

  /**
   * Internal helper to remove the global click listener.
   */
  function uninitAuto() {
    if (!autoHandler) {
      return;
    }

    detachAutoHandlers(autoHandler);
    autoHandler = null;
  }

  function initSpotlight() {
    if (__spotlight_instance) {
      return __spotlight_instance;
    }
    const inst = new Spotlight();
    __spotlight_instance = inst;
    return inst;
  }

  /*__SPOTLIGHT_AUTO_INIT_START__*/
  initAuto();
  /*__SPOTLIGHT_AUTO_INIT_END__*/

  /**
   * Public Spotlight API.
   * Exposes methods to control the image gallery programmatically.
   */
  window.Spotlight = {
    /**
     * Re-attaches the global click listener if it was previously removed.
     */
    init: () => initAuto(),
    /**
     * Removes the global click listener to prevent auto-detection.
     */
    uninit: () => uninitAuto(),
    /**
     * Gets the current Spotlight instance.
     * @returns {Spotlight|null}
     */
    get instance() {
      return __spotlight_instance || null;
    },
    /**
     * Global configuration object.
     * @type {Object}
     */
    config: Object.freeze({ ...DEFAULT_CONFIG }),
    /**
     * Gets whether debug mode is enabled.
     * @returns {boolean}
     */
    get debug() {
      return (__spotlight_instance && __spotlight_instance.debug) || false;
    },
    /**
     * Sets debug mode.
     * @param {boolean} val
     */
    set debug(val) {
      const v = Boolean(val);
      __spotlight_debug__ = v;
      if (__spotlight_instance) {
        __spotlight_instance.debug = v;
      }
    },
    /**
     * Opens a specific image in a collection.
     * @param {number} [collectionIndex=0] - The index of the gallery collection.
     * @param {number} [itemIndex=0] - The index of the image within the collection.
     */
    open: (collectionIndex = 0, itemIndex = 0) => {
      if (!__spotlight_instance) {
        initSpotlight();
      }
      __spotlight_instance.openCollection(collectionIndex, itemIndex);
    },
    /**
     * Re-scans the DOM for image collections. Useful after dynamic content loading.
     * Safely destroys the old instance to prevent memory leaks before initializing a new one.
     * @returns {Spotlight} The new Spotlight instance.
     */
    rescan: () => {
      const inst = __spotlight_instance;
      if (inst) {
        try {
          inst.destroy();
        } catch (err) {
          if (typeof inst._reportError === 'function') {
            inst._reportError('rescan.destroy', err);
          }
        }
      }
      __spotlight_instance = null;
      return initSpotlight();
    },
    /**
     * Returns an array of captured errors (if any).
     * @returns {Array<{op: string, err: Error, time: number}>}
     */
    getCapturedErrors: () => {
      return (
        (__spotlight_instance && __spotlight_instance._getCapturedErrors()) ||
        []
      );
    },
    /**
     * Clears the captured error log.
     */
    clearCapturedErrors: () => {
      if (__spotlight_instance) {
        __spotlight_instance._clearCapturedErrors();
      }
    },
  };
})();
