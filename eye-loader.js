/*!
 * eye-loader.js - standalone intro loader (vanilla JS, no dependencies, no build step)
 *
 * An eye drawn as a grid of monospace characters fades in, opens, looks around,
 * zooms in, turns its iris into a 4-point star, sparkles, and then falls apart
 * into pixels to reveal the page underneath.
 *
 * INSTALL  Load this file as early as possible in the document head with one
 *          script tag (src="eye-loader.js"), or paste the whole file into an
 *          inline script tag. It creates its own canvas and removes every trace
 *          of itself when it is done.
 *
 * CONFIG   Optional, must be set before this script runs:
 *          window.EyeLoaderConfig = { speed: 1, once: true, bg: "#09090B", accent: "#3B82F6" };
 *          ("pink" is accepted as another name for "accent".)
 *
 * HOOKS    html.eye-loading    class present while the loader is running
 *          html.eye-loaded     class added about 25% into the dissolve
 *          "eyeloader:done"    CustomEvent on document once everything is gone
 *          window.EyeLoader    { replay(), skip() }
 *
 * The default palette is the colour scheme of antoniomato.gr.
 */
(function (window, document) {
  'use strict';

  if (window.EyeLoader) return;                 // included twice: the first copy stays in charge

  var html = document.documentElement;

  /* ====================================================================
   * 1. CONFIG
   * ==================================================================== */

  var cfg = window.EyeLoaderConfig || {};
  var SPEED = +cfg.speed > 0 ? Math.min(Math.max(+cfg.speed, 0.1), 10) : 1;   // scales the whole timeline
  var ONCE = cfg.once !== false;                                              // once per browser session

  var SESSION_KEY = 'eyeLoader:seen';
  var DONE_CLASS = 'eye-loaded';
  var RUN_CLASS = 'eye-loading';
  var DONE_EVENT = 'eyeloader:done';

  var MAX_CELLS = 28000;      // above this (screens beyond roughly 1920 x 1300) the characters grow instead
  var DRAW_BUDGET = 900;      // 2D fallback only: characters redrawn per frame

  /* ====================================================================
   * 2. SMALL HELPERS
   * ==================================================================== */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }

  // easeInOutCubic (clamped): every phase of the timeline runs through this
  function ease(k) {
    k = clamp01(k);
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }

  // smoothstep; also works "backwards" when a > b
  function sstep(a, b, v) {
    var k = clamp01((v - a) / (b - a));
    return k * k * (3 - 2 * k);
  }

  // small overshoot, used when a sparkle pops in
  function backOut(k) {
    k -= 1;
    return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
  }

  // fast exp(-v) from a table; the shading calls this several times per character
  var EXP = null;
  function fexp(v) { return v <= 0 ? 1 : v >= 8 ? 0 : EXP[(v * 128) | 0]; }

  function mix(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }

  // deterministic random numbers, so the eye looks the same on every visit
  function prng(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var v = Math.imul(a ^ (a >>> 15), 1 | a);
      v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newCanvas(w, h) {
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* ====================================================================
   * 3. COLOURS
   * ==================================================================== */

  // Any CSS colour string -> [r, g, b]. The canvas normalises it, no pixels are read back.
  function parseColor(str) {
    if (typeof str !== 'string' || !str) return null;
    try {
      var g = document.createElement('canvas').getContext('2d'), m;
      g.fillStyle = '#010203';
      g.fillStyle = str;                        // silently ignored when it is not a colour
      str = String(g.fillStyle);
      if (str === '#010203') return null;
      if ((m = /^#(..)(..)(..)$/.exec(str))) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
      if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(str))) return [+m[1], +m[2], +m[3]];
    } catch (e) {}
    return null;
  }

  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, h = 0, s = 0;
    if (d > 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    s = clamp01(s); l = clamp01(l);
    var c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60;
    var x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; } else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; } else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  // The default palette is taken straight from the CSS tokens of antoniomato.gr.
  // A custom accent keeps the same roles and derives the other tones from it.
  var SITE_ACCENT = [59, 130, 246];                                  // --marker       #3B82F6
  var accentIn = parseColor(cfg.accent || cfg.pink);
  var custom = !!accentIn && (accentIn[0] !== 59 || accentIn[1] !== 130 || accentIn[2] !== 246);
  var hsl = rgbToHsl(custom ? accentIn : SITE_ACCENT);

  var BG = parseColor(cfg.bg) || [9, 9, 11];                                           // --ink-900      #09090B
  var AC = custom ? accentIn : SITE_ACCENT;                                            // accent
  var LI = custom ? hslToRgb(hsl[0], hsl[1] * 0.80, 0.87) : [198, 213, 241];           // light accent   --chalk-tint  #C6D5F1
  var DP = custom ? hslToRgb(hsl[0], hsl[1] * 0.78, hsl[2] * 0.78) : [29, 78, 216];    // deep accent    --marker-deep #1D4ED8
  var DK = custom ? hslToRgb(hsl[0], hsl[1] * 0.75, 0.26) : [16, 38, 112];             // dark accent
  var SC = custom ? hslToRgb(hsl[0], 0.22, 0.92) : [228, 234, 245];                    // sclera
  var SK = custom ? hslToRgb(hsl[0], 0.19, 0.50) : [108, 127, 150];                    // skin           --chalk-faint #6C7F96
  var LC = mix(DP, AC, 0.45);                                                          // lashes
  var LN = mix(AC, LI, 0.30);                                                          // the closed eye: one bright line
  var ST = mix(AC, LI, 0.22);                                                          // the star, before it turns white
  var CA = mix(AC, LI, 0.40);                                                          // caruncle (tear duct)
  var BGC = mix(SK, LI, 0.35);                                                         // dim background characters

  var BG_CSS = rgb(BG), AC_CSS = rgb(AC), LI_CSS = rgb(LI), WHITE_CSS = '#fff';

  /* ====================================================================
   * 4. TIMELINE (seconds at speed 1)
   * ==================================================================== */

  var D_FADE = 0.5, D_OPEN = 1.0, D_LOOK = 2.0, D_ZOOM = 1.3, D_MORPH = 1.2, D_SPARK = 1.3, D_DISS = 1.3;

  var T_OPEN = D_FADE;                          // lids open
  var T_LOOK = T_OPEN + D_OPEN;                 // look around
  var T_ZOOM = T_LOOK + D_LOOK;                 // zoom in
  var T_MORPH = T_ZOOM + 0.55 * D_ZOOM;         // iris -> star, starts 55% into the zoom
  var T_SPARK = T_MORPH + 0.60 * D_MORPH;       // sparkles, start 60% into the morph
  var T_DISS = T_SPARK + D_SPARK;               // dissolve

  // gaze keyframes: fraction of the look phase, x, y (eye units, y points down)
  var GAZE = [
    0.00,  0.00,  0.00,
    0.12,  0.00,  0.00,
    0.24, -0.42,  0.02,
    0.40, -0.42,  0.02,
    0.50,  0.38, -0.04,
    0.64,  0.38, -0.04,
    0.74, -0.12, -0.16,
    0.86, -0.12, -0.16,
    1.00,  0.00,  0.00
  ];

  /* ====================================================================
   * 5. CHARACTER RAMP + NOISE
   * ==================================================================== */

  // dark -> bright
  var RAMP = " .`-':,_^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
  var RAMP_N = RAMP.length;
  var CH_PIPE = RAMP.indexOf('|'), CH_SLASH = RAMP.indexOf('/'), CH_BACK = RAMP_N;   // "\" is an extra atlas tile

  // value-noise tables (filled by buildTables)
  var NT = null, NP = null;

  // 2D value noise, 0..1
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    var x0 = xi & 255, x1 = (xi + 1) & 255, y0 = yi & 255, y1 = (yi + 1) & 255;
    var a = NT[NP[NP[x0] + y0]], b = NT[NP[NP[x1] + y0]], c = NT[NP[NP[x0] + y1]], d = NT[NP[NP[x1] + y1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // the same, but wrapping in x every `per` cells (for noise that runs around the iris)
  function vnoiseWrap(x, y, per) {
    var xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    var x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, y0 = yi & 255, y1 = (yi + 1) & 255;
    var a = NT[NP[NP[x0] + y0]], b = NT[NP[NP[x1] + y0]], c = NT[NP[NP[x0] + y1]], d = NT[NP[NP[x1] + y1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // 1D value noise around a circle: a = angle as 0..1, f = cycles per turn
  function ring(a, f, s) {
    var v = a * f, i0 = Math.floor(v), u = v - i0;
    u = u * u * (3 - 2 * u);
    var p0 = NT[((i0 % f) + s) & 255], p1 = NT[(((i0 + 1) % f) + s) & 255];
    return p0 + (p1 - p0) * u;
  }

  /* ====================================================================
   * 6. EYE GEOMETRY
   *
   * Eye units: the eye is 2 units wide (half-width = 1), x runs to the right,
   * y runs down, and (0, 0) is the middle of the screen. The inner corner
   * (tear duct) is on the left.
   * ==================================================================== */

  // lid heights above / below the corner-to-corner axis; ex = x / 0.86
  function lidUpper(ex) {
    var a = 1 - (ex - 0.1) * (ex - 0.1) / 1.05;
    return a > 0 ? 0.52 * Math.pow(a, 0.62) * (1 - 0.15 * (ex > 0 ? ex : 0)) : 0;
  }
  function lidLower(ex) {
    var a = 1 - (ex + 0.14) * (ex + 0.14) / 1.1;
    return a > 0 ? 0.34 * Math.pow(a, 0.8) : 0;
  }

  // The upper lid is 0.52 high and the lower one 0.34. Shifting everything down by
  // half the difference keeps the opening centred on the screen while it opens.
  var CENTRE = (0.52 - 0.34) / 2;

  // lashes: sparse, rooted on the upper lid, leaning away from its middle (filled by buildTables)
  var LASH_N = 0, LASH_EX = [], LASH_LEN = [], LASH_LEAN = [], LASH_CH = [];

  // Fixed lookup tables. Built on the first run only, so a skipped loader costs nothing.
  function buildTables() {
    var rnd = prng(20261), k, j, swap, ex, lean, mid;

    EXP = new Float32Array(1025);
    for (k = 0; k < 1025; k++) EXP[k] = Math.exp(-k / 128);

    NT = new Float32Array(256);
    NP = new Uint8Array(512);
    for (k = 0; k < 256; k++) { NT[k] = rnd(); NP[k] = k; }
    for (k = 255; k > 0; k--) { j = (rnd() * (k + 1)) | 0; swap = NP[k]; NP[k] = NP[j]; NP[j] = swap; }
    for (k = 0; k < 256; k++) NP[k + 256] = NP[k];

    rnd = prng(41);
    for (ex = -0.76; ex < 1.03; ex += 0.052 + rnd() * 0.05) {
      mid = 1 - Math.min(1, Math.abs(ex - 0.25) / 0.95);                    // longest a little outside the middle
      lean = clamp((ex - 0.1) * 0.72 + (rnd() - 0.5) * 0.16, -0.7, 0.7);    // sideways drift per unit of height
      LASH_EX.push(ex);
      LASH_LEN.push(0.06 + 0.08 * (0.3 * rnd() + 0.7 * mid));               // 0.06 .. 0.14
      LASH_LEAN.push(lean);
      LASH_CH.push(Math.abs(lean) * 1.5 < 0.36 ? CH_PIPE : lean < 0 ? CH_BACK : CH_SLASH);
      LASH_N++;
    }
  }

  // The iris texture never changes, so it is baked once into a table: angle (512 steps) x radius (64 steps).
  var IRIS = null, IRIS_RGB = null;
  function buildIris() {
    var a, r, ang, rho, fib, wave, v, cd, k1, k2, k3, c;
    IRIS = new Float32Array(512 * 64);
    IRIS_RGB = new Float32Array(64 * 3);
    for (a = 0; a < 512; a++) {
      ang = (a + 0.5) / 512;
      // radial fibres: value noise of the angle at three frequencies
      fib = 0.5 * ring(ang, 31, 0) + 0.3 * ring(ang, 71, 40) + 0.2 * ring(ang, 149, 90);
      wave = 0.04 * (ring(ang, 9, 150) - 0.5);
      for (r = 0; r < 64; r++) {
        rho = (r + 0.5) / 64;
        v = 0.60 + 0.42 * fib;
        if (rho > 0.42 && rho < 0.9) {            // crypts: darker pits in the outer half
          v *= 1 - 0.5 * sstep(0.58, 0.82, vnoiseWrap(ang * 36, rho * 5.5 + 2.7, 36)) *
               sstep(0.42, 0.55, rho) * (1 - sstep(0.76, 0.9, rho));
        }
        cd = (rho - 0.60 - wave) / 0.07;          // collarette: brighter, slightly wavy ring at 60% of the radius
        v += 0.24 * Math.exp(-cd * cd);
        v *= 1 - 0.9 * sstep(0.84, 0.99, rho);    // strong dark limbal ring at the edge
        IRIS[a * 64 + r] = v;
      }
    }
    // colour by radius: light accent in the middle -> accent -> deep accent -> dark accent at the edge
    for (r = 0; r < 64; r++) {
      rho = (r + 0.5) / 64;
      k1 = sstep(0.40, 0.66, rho); k2 = sstep(0.70, 0.92, rho); k3 = sstep(0.92, 1, rho);
      c = mix(mix(mix(LI, AC, k1), DP, k2), DK, k3);
      IRIS_RGB[r * 3] = c[0]; IRIS_RGB[r * 3 + 1] = c[1]; IRIS_RGB[r * 3 + 2] = c[2];
    }
  }

  /* ====================================================================
   * 7. STATE
   * ==================================================================== */

  var running = false, rafId = 0;

  var canvas = null;                            // the one visible canvas
  var gl = null, glS = null;                    // WebGL: one shader pass draws the whole character grid
  var ctx = null;                               // 2D fallback: the visible canvas composites ...
  var glyphs = null, gctx = null;               // ... an off-screen frame of grey characters ...
  var tint = null, tctx = null, tintImg = null; // ... multiplied by a one-pixel-per-cell colour map
  var atlas = null;                             // the ramp, pre-rendered once (off-screen)
  var cover = null;                             // the anti-flash style tag

  var W = 0, H = 0, dpr = 1, CW = 0, CH = 0;    // CSS size, pixel ratio, backing-store size
  var cellW = 0, cellH = 0, cols = 0, rows = 0; // character grid (device pixels)
  var unit = 1, cx = 0, cy = 0, zoomMax = 1.9;  // eye unit in device pixels, screen centre
  var skinX = 1, skinY = 1;                     // where the skin has faded into the background

  var jit, seed, bgB;                           // per cell: flicker, fade-in order, background brightness
  var last;                                     // per cell: the character currently shown
  var tintPx, tintBytes;                        // per cell: colour x alpha (RGBA bytes)
  var colX, colYU, colYL, colDc, colUW, colLW, colEye;           // per column: lid geometry
  var lashX = [], lashY = [], lashH = [];
  var wanted = 0;                               // 2D fallback: characters that asked for a redraw last frame

  var clock = 0, lastNow = 0;
  var needResize = false, firstFrame = true, wantSkip = false, classAdded = false;

  var sparkles = null, stars = null, glowWhite = null, glowAccent = null, spriteDpr = 0;
  var batch = null, batchN = 0;                                 // WebGL sprite quads for this frame
  var sliceU = null, whiteU = 0, whiteV = 0;
  var diss = null, particles = [];
  var savedOverflow = null, hadStyleAttr = false;

  var DOWN_EVENTS = window.PointerEvent ? ['pointerdown'] : ['mousedown', 'touchstart'];

  /* ====================================================================
   * 8. LIFECYCLE
   * ==================================================================== */

  function important(list) { return list.join(' !important;') + ' !important;'; }

  function start() {
    if (running) return;
    running = true;
    clock = 0; lastNow = 0;
    needResize = true; firstFrame = true; wantSkip = false; classAdded = false;
    diss = null; particles = []; sparkles = null; cellW = cellH = 0; spriteDpr = 0; wanted = 0; batchN = 0;

    try {
      // 1. Cover the page immediately, so the site never flashes before the loader.
      //    The cover goes away as soon as the canvas has drawn its first frame.
      cover = document.createElement('style');
      cover.setAttribute('data-eye-loader', '');
      cover.textContent = 'html::before{' + important([
        'content:""', 'display:block', 'position:fixed', 'top:0', 'right:0', 'bottom:0', 'left:0',
        'z-index:2147483646', 'background:' + BG_CSS, 'pointer-events:none'
      ]) + '}';
      (document.head || html).appendChild(cover);

      // 2. No scrolling while the loader runs. html.eye-loading marks that it is running.
      lockScroll();
      html.classList.add(RUN_CLASS);

      // 3. The canvas. WebGL when it is there, plain 2D otherwise.
      if (!NT) buildTables();
      batch = new Float32Array(48 * 1024);
      sliceU = new Float32Array(16);
      if (!initGL()) init2D();
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = important([
        'position:fixed', 'top:0', 'right:0', 'bottom:0', 'left:0', 'inset:0', 'width:100%', 'height:100%',
        'max-width:none', 'max-height:none', 'margin:0', 'padding:0', 'border:0', 'display:block',
        'opacity:1', 'visibility:visible', 'transform:none', 'filter:none',
        'z-index:2147483647', 'pointer-events:auto', 'background:' + BG_CSS
      ]);
      html.appendChild(canvas);               // <body> may not exist yet when this runs in the head

      // 4. Listeners: resize, and click / any key to skip.
      window.addEventListener('resize', onResize);
      for (var k = 0; k < DOWN_EVENTS.length; k++) window.addEventListener(DOWN_EVENTS[k], skip, true);
      window.addEventListener('keydown', onKey, true);

      rafId = window.requestAnimationFrame(frame);
    } catch (err) {
      fail(err);
    }
  }

  function onResize() { needResize = true; }

  function onKey(e) {
    // any key skips, but not a bare modifier or a browser / system shortcut
    if (e.ctrlKey || e.metaKey || e.altKey || /^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock|ScrollLock|Fn)$/.test(e.key)) return;
    skip();
  }

  function onContextLost(e) {
    e.preventDefault();
    if (running) fail(new Error('WebGL context lost'));
  }

  // Jump straight to the dissolve (click, key press or EyeLoader.skip()).
  function skip() {
    if (running && !diss) wantSkip = true;
  }

  function removeSkipListeners() {
    for (var k = 0; k < DOWN_EVENTS.length; k++) window.removeEventListener(DOWN_EVENTS[k], skip, true);
    window.removeEventListener('keydown', onKey, true);
  }

  function lockScroll() {
    var st = html.style, props = ['overflow-x', 'overflow-y'], k;
    hadStyleAttr = html.hasAttribute('style');
    savedOverflow = [];
    for (k = 0; k < props.length; k++) {
      savedOverflow.push([props[k], st.getPropertyValue(props[k]), st.getPropertyPriority(props[k])]);
    }
    st.setProperty('overflow', 'hidden', 'important');
  }

  function unlockScroll() {
    if (!savedOverflow) return;
    var st = html.style, k, s;
    st.removeProperty('overflow');
    for (k = 0; k < savedOverflow.length; k++) {
      s = savedOverflow[k];
      if (s[1]) st.setProperty(s[0], s[1], s[2]);
    }
    if (!hadStyleAttr && !html.getAttribute('style')) html.removeAttribute('style');
    savedOverflow = null;
  }

  function uncover() {
    if (cover && cover.parentNode) cover.parentNode.removeChild(cover);
    cover = null;
    if (canvas) canvas.style.setProperty('background', 'transparent', 'important');
  }

  function release(cv) {
    if (cv) { try { cv.width = cv.height = 0; } catch (e) {} }
  }

  // Remove everything: canvas, style tag, listeners, pending frame, scroll lock.
  function teardown() {
    var lose;
    running = false;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    window.removeEventListener('resize', onResize);
    removeSkipListeners();
    if (cover && cover.parentNode) cover.parentNode.removeChild(cover);
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    unlockScroll();
    html.classList.remove(RUN_CLASS);
    if (gl) {                                   // hand the GPU memory back right away
      try { lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) {}
    }
    release(canvas); release(glyphs); release(tint); release(atlas);
    if (diss) release(diss.mask);
    cover = canvas = gl = glS = ctx = glyphs = gctx = tint = tctx = tintImg = atlas = null;
    stars = glowWhite = glowAccent = sparkles = diss = null;
    IRIS = IRIS_RGB = batch = sliceU = null;
    jit = seed = bgB = last = tintPx = tintBytes = null;
    colX = colYU = colYL = colDc = colUW = colLW = colEye = null;
    particles = [];
  }

  function markLoaded() {
    classAdded = true;
    html.classList.add(DONE_CLASS);
  }

  function announce(played) {
    var ev;
    try {
      ev = new window.CustomEvent(DONE_EVENT, { detail: { played: played } });
    } catch (e) {
      ev = document.createEvent('CustomEvent');
      ev.initCustomEvent(DONE_EVENT, false, false, { played: played });
    }
    document.dispatchEvent(ev);
  }

  function finish() {
    teardown();
    markLoaded();
    announce(true);
  }

  // Never leave a broken loader on top of the site: on any error, get out of the way.
  function fail(err) {
    teardown();
    markLoaded();
    announce(false);
    if (window.console && window.console.warn) window.console.warn('[eye-loader] stopped:', err);
  }

  /* ====================================================================
   * 9. RENDERER SETUP
   *
   * WebGL: the visible canvas runs two tiny shaders. One draws the whole
   * character grid from three small textures (which character, which colour,
   * which blocks are dissolved); the other draws sparkles and falling pixels.
   *
   * 2D fallback: characters are stamped into an off-screen frame and the
   * visible canvas composites frame x colour map, sparkles, holes and pixels.
   * ==================================================================== */

  var VS_FRAME = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
  var FS_FRAME = [
    'precision highp float;',
    'uniform sampler2D uAtlas,uChars,uTint,uMask;',
    'uniform vec2 uRes,uCell,uGrid,uAtlasSize,uMaskSize;',
    'uniform vec3 uBg;',
    'uniform vec4 uSlice[4];',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',                    // pixel, origin top left
    '  if(texture2D(uMask,p/uMaskSize).r>.5){gl_FragColor=vec4(0.);return;}',  // dissolved block: see-through
    '  for(int k=0;k<4;k++){',                                                 // glitch slices, shifted sideways
    '    if(p.y>=uSlice[k].x&&p.y<uSlice[k].y)p.x=mod(p.x-uSlice[k].z,uRes.x);',
    '  }',
    '  vec2 cell=floor(p/uCell);',
    '  vec2 uv=(cell+.5)/uGrid;',
    '  float idx=floor(texture2D(uChars,uv).r*255.+.5);',                      // which character
    '  float glyph=texture2D(uAtlas,(vec2(idx*uCell.x,0.)+p-cell*uCell)/uAtlasSize).r;',
    '  gl_FragColor=vec4(texture2D(uTint,uv).rgb*glyph+uBg,1.);',              // character x colour + background
    '}'
  ].join('\n');
  var VS_SPRITE = [
    'attribute vec2 aPos;attribute vec2 aUV;attribute vec4 aCol;',
    'uniform vec2 uRes;varying vec2 vUV;varying vec4 vCol;',
    'void main(){vUV=aUV;vCol=aCol;gl_Position=vec4(aPos.x/uRes.x*2.-1.,1.-aPos.y/uRes.y*2.,0.,1.);}'
  ].join('\n');
  var FS_SPRITE = 'precision mediump float;uniform sampler2D uSheet;varying vec2 vUV;varying vec4 vCol;' +
                  'void main(){gl_FragColor=texture2D(uSheet,vUV)*vCol;}';

  function glProgram(g, vs, fs, attribs) {
    var p = g.createProgram(), src = [vs, fs], type = [g.VERTEX_SHADER, g.FRAGMENT_SHADER], k, s;
    for (k = 0; k < 2; k++) {
      s = g.createShader(type[k]);
      g.shaderSource(s, src[k]);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) || 'shader compile');
      g.attachShader(p, s);
    }
    for (k = 0; k < attribs.length; k++) g.bindAttribLocation(p, k, attribs[k]);
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error('shader link');
    return p;
  }

  function glTexture(g, unit, minFilter) {
    var tx = g.createTexture();
    g.activeTexture(g.TEXTURE0 + unit);         // every texture keeps its own unit for the whole run
    g.bindTexture(g.TEXTURE_2D, tx);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, minFilter);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, minFilter === g.NEAREST ? g.NEAREST : g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return tx;
  }

  function initGL() {
    var cv = document.createElement('canvas'), g = null, pf, ps, hp, buf, lose;
    var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
    try {
      g = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
      if (!g) return false;
      hp = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
      if (!hp || !hp.precision || g.getParameter(g.MAX_TEXTURE_SIZE) < 4096) throw new Error('WebGL too limited');

      pf = glProgram(g, VS_FRAME, FS_FRAME, ['aPos']);
      ps = glProgram(g, VS_SPRITE, FS_SPRITE, ['aPos', 'aUV', 'aCol']);

      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      g.disable(g.DEPTH_TEST);
      g.clearColor(0, 0, 0, 0);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);                // premultiplied alpha

      // texture units: 0 atlas, 1 characters, 2 colours, 3 dissolve mask, 4 sprite sheet
      glTexture(g, 0, g.NEAREST);
      glTexture(g, 1, g.NEAREST);
      glTexture(g, 2, g.NEAREST);
      glTexture(g, 3, g.NEAREST);
      glTexture(g, 4, g.LINEAR_MIPMAP_LINEAR);

      g.useProgram(ps);
      g.uniform1i(g.getUniformLocation(ps, 'uSheet'), 4);
      g.useProgram(pf);
      g.uniform1i(g.getUniformLocation(pf, 'uAtlas'), 0);
      g.uniform1i(g.getUniformLocation(pf, 'uChars'), 1);
      g.uniform1i(g.getUniformLocation(pf, 'uTint'), 2);
      g.uniform1i(g.getUniformLocation(pf, 'uMask'), 3);
      g.uniform3f(g.getUniformLocation(pf, 'uBg'), BG[0] / 255, BG[1] / 255, BG[2] / 255);

      buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);

      glS = {
        frame: pf, sprite: ps, quad: buf, batch: g.createBuffer(),
        uRes: g.getUniformLocation(pf, 'uRes'), uCell: g.getUniformLocation(pf, 'uCell'),
        uGrid: g.getUniformLocation(pf, 'uGrid'), uAtlasSize: g.getUniformLocation(pf, 'uAtlasSize'),
        uMaskSize: g.getUniformLocation(pf, 'uMaskSize'), uSlice: g.getUniformLocation(pf, 'uSlice[0]'),
        uResSprite: g.getUniformLocation(ps, 'uRes')
      };
      cv.addEventListener('webglcontextlost', onContextLost);
      canvas = cv;
      gl = g;
      return true;
    } catch (e) {
      // not usable: drop the half-built context and let the 2D path take over
      gl = glS = null;
      try { lose = g && g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e2) {}
      return false;
    }
  }

  function init2D() {
    canvas = document.createElement('canvas');
    glyphs = document.createElement('canvas');
    tint = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    gctx = glyphs.getContext('2d');
    tctx = tint.getContext('2d');
    if (!ctx || !gctx || !tctx) throw new Error('canvas is not available');
    ctx.globalCompositeOperation = 'multiply';
    if (ctx.globalCompositeOperation !== 'multiply') throw new Error('canvas blend modes are not available');
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ====================================================================
   * 10. SIZING (runs on the first frame and after every resize)
   * ==================================================================== */

  function resize() {
    var rect = canvas.getBoundingClientRect(), n, i, c, r, v;

    W = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    H = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    dpr = Math.min(dpr, Math.sqrt(16e6 / (W * H)));              // never more than 16 million canvas pixels
    CW = Math.round(W * dpr);
    CH = Math.round(H * dpr);
    canvas.width = CW;
    canvas.height = CH;

    // 8 x 12 CSS pixels per character, snapped to whole device pixels so the grid stays crisp.
    // Very large screens get proportionally larger characters, which bounds the work per frame.
    var grow = Math.max(1, Math.sqrt(W * H / 96 / MAX_CELLS));
    var cw = Math.max(2, Math.round(8 * dpr * grow)), ch = Math.max(3, Math.round(12 * dpr * grow));
    var newCells = cw !== cellW || ch !== cellH;
    cellW = cw;
    cellH = ch;
    cols = Math.ceil(CW / cellW);
    rows = Math.ceil(CH / cellH);
    n = cols * rows;

    jit = new Float32Array(n);
    seed = new Float32Array(n);
    bgB = new Float32Array(n);
    last = new Uint8Array(n);                   // 0 = space
    for (r = 0, i = 0; r < rows; r++) {
      for (c = 0; c < cols; c++, i++) {
        v = vnoise(c * 0.085 + 11, r * 0.125 + 5);
        bgB[i] = 0.015 + 0.11 * v * v;          // faint clouds of background characters
        seed[i] = Math.random();
        jit[i] = (Math.random() - 0.5) * 0.16;
      }
    }
    colX = new Float32Array(cols); colYU = new Float32Array(cols); colYL = new Float32Array(cols);
    colDc = new Float32Array(cols); colUW = new Float32Array(cols); colLW = new Float32Array(cols);
    colEye = new Uint8Array(cols);

    if (gl) {
      tintPx = new Uint8ClampedArray(n * 4);
      tintBytes = new Uint8Array(tintPx.buffer);
      gl.viewport(0, 0, CW, CH);
      gl.useProgram(glS.sprite);
      gl.uniform2f(glS.uResSprite, CW, CH);
      gl.useProgram(glS.frame);
      gl.uniform2f(glS.uRes, CW, CH);
      gl.uniform2f(glS.uCell, cellW, cellH);
      gl.uniform2f(glS.uGrid, cols, rows);
      gl.uniform2f(glS.uMaskSize, CW, CH);
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, last);
      gl.activeTexture(gl.TEXTURE2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, tintBytes);
      gl.activeTexture(gl.TEXTURE3);            // nothing dissolved yet
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(1));
    } else {
      glyphs.width = CW;
      glyphs.height = CH;
      gctx.fillStyle = '#000';
      gctx.fillRect(0, 0, CW, CH);
      tint.width = cols;
      tint.height = rows;
      tintImg = tctx.createImageData(cols, rows);
      tintPx = tintImg.data;
      for (i = 3; i < n * 4; i += 4) tintPx[i] = 255;
      wanted = 0;
    }

    if (newCells) buildAtlas();
    if (dpr !== spriteDpr) { spriteDpr = dpr; buildSprites(); }
    if (!IRIS) buildIris();

    unit = Math.min(W * 0.40, H * 0.95) * dpr;
    cx = CW / 2;
    cy = CH / 2;
    // 1.9x, a little less only where the star would no longer fit the height (very wide screens)
    zoomMax = clamp(0.49 * CH / (0.36 * unit), 1, 1.9);
    // the skin fades out inside a rounded box that just fits the screen at 1x
    skinX = clamp(0.985 * CW / 2 / unit - 0.75, 0.3, 0.55);
    skinY = clamp(0.985 * CH / 2 / unit, 0.62, 0.95);

    if (!sparkles || clock < T_SPARK) makeSparkles();
  }

  // Every character of the ramp, white on black, one tile per character.
  function buildAtlas() {
    var n = RAMP_N + 1, raw = newCanvas(n * cellW, cellH), g = raw.getContext('2d'), k;
    g.font = '600 ' + (11 * cellH / 12) + 'px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    for (k = 0; k < n; k++) {
      g.save();
      g.beginPath();
      g.rect(k * cellW, 0, cellW, cellH);
      g.clip();                                 // a glyph never leaks into its neighbour's tile
      g.fillText(k < RAMP_N ? RAMP.charAt(k) : '\\', k * cellW + cellW / 2, Math.round(cellH * 0.79));
      g.restore();
    }
    release(atlas);
    atlas = newCanvas(raw.width, cellH);
    g = atlas.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, atlas.width, cellH);
    g.drawImage(raw, 0, 0);
    release(raw);
    if (gl) {
      gl.activeTexture(gl.TEXTURE0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.useProgram(glS.frame);
      gl.uniform2f(glS.uAtlasSize, atlas.width, atlas.height);
    }
  }

  // concave 4-point star with a glow, pre-rendered once (the glow is a real shadowBlur)
  function starSprite(span, core, glow) {
    var blur = Math.max(2, span * 0.24), pad = Math.ceil(blur * 1.7), box = Math.ceil(span) + pad * 2;
    var cv = newCanvas(box, box), g = cv.getContext('2d'), k, a, cs, sn, rad = span / 2;
    g.translate(box / 2, box / 2);
    g.beginPath();
    for (k = 0; k <= 72; k++) {
      a = k / 72 * 6.28318531;
      cs = Math.cos(a); sn = Math.sin(a);
      g.lineTo(rad * Math.pow(Math.abs(cs), 3.4) * (cs < 0 ? -1 : 1), rad * Math.pow(Math.abs(sn), 3.4) * (sn < 0 ? -1 : 1));
    }
    g.closePath();
    g.shadowColor = glow;
    g.shadowBlur = blur;
    g.fillStyle = glow;
    g.fill();
    g.fillStyle = core;
    g.fill();
    return { img: cv, box: box, grow: box / span };
  }

  // small glowing square for the sparkle bursts
  function squareSprite(core, glow) {
    var side = Math.round(6 * dpr), blur = 5 * dpr, pad = Math.ceil(blur * 1.7), box = side + pad * 2;
    var cv = newCanvas(box, box), g = cv.getContext('2d');
    g.shadowColor = glow;
    g.shadowBlur = blur;
    g.fillStyle = core;
    g.fillRect(pad, pad, side, side);
    g.fillRect(pad, pad, side, side);
    return { img: cv, box: box, grow: box / side };
  }

  function buildSprites() {
    var spans = gl ? [56] : [56, 24, 10], k;     // 2D keeps three sizes so small sparkles stay sharp; WebGL uses mipmaps
    stars = [];
    for (k = 0; k < spans.length; k++) {
      stars.push({
        accent: starSprite(spans[k] * dpr, AC_CSS, AC_CSS),
        white: starSprite(spans[k] * dpr, WHITE_CSS, LI_CSS)
      });
    }
    glowWhite = squareSprite(WHITE_CSS, LI_CSS);
    glowAccent = squareSprite(AC_CSS, AC_CSS);
    if (gl) buildSheet();
  }

  // WebGL: all sprites on one 512 px sheet (plus a white patch for plain squares)
  function buildSheet() {
    var SIZE = 512, sheet = newCanvas(SIZE, SIZE), g = sheet.getContext('2d');
    var list = [stars[0].accent, stars[0].white, glowAccent, glowWhite], k, s;
    var x = 0, y = 0, rowH = 0;
    for (k = 0; k < list.length; k++) {
      s = list[k];
      if (x + s.box > SIZE) { x = 0; y += rowH + 8; rowH = 0; }
      g.drawImage(s.img, x, y);
      s.u0 = x / SIZE; s.v0 = y / SIZE; s.u1 = (x + s.box) / SIZE; s.v1 = (y + s.box) / SIZE;
      release(s.img);
      s.img = null;
      x += s.box + 8;
      rowH = Math.max(rowH, s.box);
    }
    if (x + 16 > SIZE) { x = 0; y += rowH + 8; }
    g.fillStyle = '#fff';
    g.fillRect(x, y, 16, 16);
    whiteU = (x + 8) / SIZE;
    whiteV = (y + 8) / SIZE;

    gl.activeTexture(gl.TEXTURE4);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    release(sheet);
  }

  /* ====================================================================
   * 11. SHADING: brightness + colour + alpha for every character cell
   * ==================================================================== */

  function shade(ts, tw, dt) {
    var c, r, k, i, o;

    /* ---- where the timeline is ---- */
    var fading = ts < D_FADE;
    var fadeP = ease(ts / D_FADE) * 1.3;

    var open = 0.04 + 0.96 * ease((ts - T_OPEN) / D_OPEN);       // lids: 0.04 (a line) -> 1
    var gx = 0, gy = 0;                                          // gaze = centre of the iris
    var look = (ts - T_LOOK) / D_LOOK;
    if (look > 0 && look < 1) {
      for (k = 3; k < GAZE.length; k += 3) {
        if (look <= GAZE[k]) {
          var ge = ease((look - GAZE[k - 3]) / (GAZE[k] - GAZE[k - 3]));
          gx = lerp(GAZE[k - 2], GAZE[k + 1], ge);
          gy = lerp(GAZE[k - 1], GAZE[k + 2], ge);
          break;
        }
      }
      // one blink centred on 45% of the phase: close and open over 0.24 s on a sine
      var blink = (ts - T_LOOK - 0.45 * D_LOOK) / 0.24 + 0.5;
      if (blink > 0 && blink < 1) open = Math.max(0.04, 1 - Math.sin(Math.PI * blink));
    }

    var zoom = 1 + (zoomMax - 1) * ease((ts - T_ZOOM) / D_ZOOM);
    var mLin = clamp01((ts - T_MORPH) / D_MORPH), m = ease(mLin);
    var P = 2 - 1.5 * m, invP = 1 / P;                           // superellipse: 2 = circle, 0.5 = concave star
    var R = lerp(0.37, 0.36, m) * (1 + 0.012 * m * Math.sin(tw * 7));        // iris radius, tiny pulse
    var eyeK = 1 - ease(mLin / 0.7);                             // sclera, lids and skin fade out
    var detail = 1 - ease(mLin / 0.8);                           // iris texture -> flat star
    var pupil = 0.39 * (1 + 0.045 * Math.sin(tw * 1.7)) * (1 - ease(mLin / 0.55));   // share of the iris radius
    var pupilK = clamp01(pupil / 0.05);
    var catchOn = ts < T_MORPH;                                  // catchlights vanish at once
    var whiteK = ease((ts - T_SPARK) / D_SPARK);                 // the star brightens toward white

    var lift = 1 + 0.7 * Math.max(0, -gy);                       // the upper lid lifts when looking up
    var closedK = 1 - sstep(0.05, 0.3, open);                    // 1 = the eye is just a line
    var creaseK = sstep(0.15, 0.7, open);
    var lashK = 0.2 + 0.8 * sstep(0.1, 0.8, open);
    var centre = CENTRE * open;

    var U = unit * zoom, invU = 1 / U;
    var cellWu = cellW * invU, cellHu = cellH * invU, halfW = cellWu / 2;
    var RB = R * 1.3 + cellWu;                                   // star + its halo
    // The star's tips get thinner than one character. Growing the shape by half a cell
    // (only as it becomes a star) keeps them a continuous line on any screen size.
    var padX = halfW * m, padY = cellHu / 2 * m;
    var invSX = 1 / (skinX * skinX), invSY = 1 / (skinY * skinY);
    var wetH = Math.max(0.018, cellHu);

    var sR = lerp(ST[0], 255, whiteK), sG = lerp(ST[1], 255, whiteK), sB = lerp(ST[2], 255, whiteK);

    // catchlights: a 4-pane "window" upper left of the iris, a tiny dot lower right
    var wX = gx * 0.86 - 0.125, wY = gy * 0.86 - 0.145, wHX = 0.058, wHY = 0.066;
    var paneX = wHX * U > 2.2 * cellW ? Math.max(0.11, halfW / wHX) : 0;
    var paneY = wHY * U > 2.2 * cellH ? Math.max(0.11, cellHu / 2 / wHY) : 0;
    var dotX = gx * 0.86 + 0.15, dotY = gy * 0.86 + 0.17, dotR = Math.max(0.026, 0.55 * cellHu);
    dotR *= dotR;

    /* ---- lids, once per column ---- */
    for (c = 0; c < cols; c++) {
      var x0 = ((c + 0.5) * cellW - cx) * invU, ex = x0 / 0.86, tilt = 0.06 * ex;    // outer corner sits higher
      var up = lidUpper(ex), lo = lidLower(ex);
      var yu0 = -tilt - up * open * lift + centre, yl0 = -tilt + lo * open + centre;
      // never thinner than one character row, so the closed eye stays a visible line
      if (up + lo > 0 && yl0 - yu0 < cellHu) {
        var midY = (yu0 + yl0) / 2;
        yu0 = midY - cellHu / 2;
        yl0 = midY + cellHu / 2;
      }
      colX[c] = x0;
      colYU[c] = yu0;
      colYL[c] = yl0;
      colEye[c] = up + lo > 0 ? 1 : 0;
      colUW[c] = sstep(0, 0.16, up);                             // upper-lid features fade out at the corners
      colLW[c] = sstep(0, 0.12, lo);
      // the crease stays where the fully open lid tucks in, so a closing lid shows more skin
      colDc[c] = Math.max(0.03, yu0 - (-tilt - up * lift + CENTRE) + 0.045 + 0.065 * sstep(0, 0.3, up));
    }

    /* ---- lash roots ---- */
    for (k = 0; k < LASH_N; k++) {
      lashX[k] = LASH_EX[k] * 0.86;
      lashY[k] = -0.06 * LASH_EX[k] - lidUpper(LASH_EX[k]) * open * lift + centre;
      lashH[k] = LASH_LEN[k] * lashK;
    }

    /* ---- every cell ---- */
    var reroll = 1 - Math.exp(-12 * dt);                         // flicker: each cell re-rolls about 12x per second
    var brightest = RAMP_N - 1;
    var odds = gctx ? Math.min(1, DRAW_BUDGET / Math.max(1, wanted)) : 1;    // 2D fallback: spread redraws over frames
    wanted = 0;
    i = 0; o = 0;

    for (r = 0; r < rows; r++) {
      var y = ((r + 0.5) * cellH - cy) * invU;
      var scan = (r & 1) ? 0.84 : 1;                             // odd rows 16% dimmer: scanlines
      var rowFade = 0.28 * r / rows;                             // fade-in runs slightly top-down
      var qy = y * y * invSY;
      var dy = y - gy, ady = dy < 0 ? -dy : dy;
      var sy = ady > padY ? ady - padY : 0;
      var rowY = r * cellH;

      for (c = 0; c < cols; c++, i++, o += 4) {
        var x = colX[c], ax = x < 0 ? -x : x;

        // background: dim characters
        var B = bgB[i], A = 0.5, cR = BGC[0], cG = BGC[1], cB = BGC[2];
        var force = -1;

        var yu = colYU[c], yl = colYL[c];
        var inEye = colEye[c] === 1 && y > yu && y < yl;

        // distance from the iris centre in iris radii (superellipse metric); 9 = far away
        var dx = x - gx, adx = dx < 0 ? -dx : dx, rho = 9;
        if (adx < RB && ady < RB) {
          rho = (P > 1.999 ? Math.sqrt(dx * dx + dy * dy)
                           : Math.pow(Math.pow(adx > padX ? adx - padX : 0, P) + Math.pow(sy, P), invP)) / R;
        }

        var hx = ax - 0.75, q = (hx > 0 ? hx * hx * invSX : 0) + qy;         // 1 = skin fully faded

        if (rho < 1 && (inEye || eyeK < 0.004)) {
          /* ---------------- iris, morphing into the star ---------------- */
          var sb = lerp(0.8 + 0.2 * (1 - rho), 1, whiteK) * (0.55 + 0.45 * sstep(1, 0.9, rho));
          if (detail > 0.004) {
            var ri = (rho * 64) | 0;
            var ib = IRIS[((Math.atan2(dy, dx) * 81.4873308631 + 256) & 511) * 64 + ri];   // fibres, crypts, collarette, limbal ring
            ib *= 0.66 + 0.34 * sstep(pupil, pupil + 0.14, rho);             // darker zone next to the pupil
            ib *= 1 + 0.22 * dy / R;                                         // lit from above: lower half lighter
            ib *= 1 - 0.76 * eyeK * fexp((y - yu) / 0.10);                   // deep shadow of the upper lid and lashes
            var iR = IRIS_RGB[ri * 3], iG = IRIS_RGB[ri * 3 + 1], iB = IRIS_RGB[ri * 3 + 2];

            // pupil (shrinks to nothing during the morph)
            var pk = sstep(pupil + 0.02, pupil - 0.03, rho) * pupilK;
            if (pk > 0) {
              ib += (0.012 - ib) * pk;
              iR += (DK[0] - iR) * pk; iG += (DK[1] - iG) * pk; iB += (DK[2] - iB) * pk;
            }

            B = sb + (ib - sb) * detail;
            cR = sR + (iR - sR) * detail; cG = sG + (iG - sG) * detail; cB = sB + (iB - sB) * detail;
          } else {
            B = sb; cR = sR; cG = sG; cB = sB;
          }
          A = 1;

        } else if (eyeK > 0.004 && q < 1) {
          if (inEye) {
            /* ---------------- sclera ---------------- */
            var dU = y - yu, dL = yl - y;
            var bS = 0.92 - 0.42 * sstep(0.15, 1, ax);                       // a sphere: darker toward the corners
            var di = Math.sqrt(dx * dx + dy * dy) - R;
            bS += 0.09 * fexp(di * di * 33);                                 // brighter bulge around the iris
            bS *= 1 - 0.76 * fexp(dU / 0.085);                               // heavy shadow under the upper lid
            bS *= 1 - 0.36 * fexp(dL / 0.045);                               // soft shadow above the lower lid
            var vein = 0;
            if (ax > 0.3) {                                                  // faint veins, more toward the corners
              vein = vnoise(x * 4.5 + 31, y * 12 + 7) * 2 - 1;
              if (vein < 0) vein = -vein;
              vein = (1 - sstep(0.01, 0.07, vein)) * sstep(0.3, 0.8, ax);
              bS *= 1 - 0.22 * vein;
            }
            var tk = 0.05 + 0.30 * sstep(0.4, 1, ax) + 0.4 * vein;           // corners pick up the accent
            var eR = SC[0] + (AC[0] - SC[0]) * tk, eG = SC[1] + (AC[1] - SC[1]) * tk, eB = SC[2] + (AC[2] - SC[2]) * tk;

            if (x < -0.78) {                                                 // caruncle at the inner corner
              var car = sstep(-0.78, -0.9, x);
              bS += (0.42 + 0.25 * vnoise(x * 38, y * 38) - bS) * car;
              eR += (CA[0] - eR) * car; eG += (CA[1] - eG) * car; eB += (CA[2] - eB) * car;
            }
            if (dL < wetH) {                                                 // wet highlight along the lower lid
              var wet = sstep(1.05, 0.5, ax) * (0.45 + 0.55 * vnoise(x * 8 + 2, 3.5));
              bS += (1 - bS) * wet;
              eR += (255 - eR) * wet; eG += (255 - eG) * wet; eB += (255 - eB) * wet;
            }
            B += (bS - B) * eyeK; A += (1 - A) * eyeK;
            cR += (eR - cR) * eyeK; cG += (eG - cG) * eyeK; cB += (eB - cB) * eyeK;

          } else {
            /* ---------------- skin: lids, crease, brow, cheek ---------------- */
            var ws = (1 - sstep(0.55, 1, q)) * eyeK;                         // fades smoothly into the background
            var bK, d;
            if (y <= yu) {
              // above the eye
              d = yu - y;
              var Dc = colDc[c], uw = colUW[c];
              if (d < Dc) {
                bK = lerp(0.19, 0.18 + 0.31 * Math.sin(3.14159265 * d / Dc), uw);     // convex lid: lighter in the middle
              } else {
                var eb = (d - Dc - 0.10) / 0.085;
                bK = 0.14 + 0.33 * fexp(eb * eb);                            // brow-bone highlight
              }
              var ec = (d - Dc) / 0.028;
              bK *= 1 - 0.7 * creaseK * uw * fexp(ec * ec);                  // lid crease
              bK *= 1 - 0.88 * uw * (1 - sstep(0.012, 0.045, d));            // dark lash-base band

              // lashes: "\", "|" and "/" leaning outward
              if (d < 0.16 && ws > 0.15) {
                for (k = 0; k < LASH_N; k++) {
                  var lx = x - lashX[k];
                  if (lx > 0.12 || lx < -0.12) continue;
                  var lh = lashY[k] - y;                                     // height above this lash's root
                  if (lh < 0 || lh > lashH[k]) continue;
                  lx -= LASH_LEAN[k] * lh;
                  if (lx < halfW && lx >= -halfW) { force = LASH_CH[k]; break; }
                }
              }
            } else {
              // under the eye: darker near the lid, lighter on the cheek
              d = y - yl;
              bK = lerp(0.19, 0.11 + 0.25 * sstep(0, 0.14, d) + 0.07 * fexp(d / 0.02), colLW[c]);
            }
            bK *= 0.84 + 0.32 * vnoise(x * 10 + 5, y * 10 + 9);
            var hl = sstep(0.22, 0.5, bK) * 0.35;                            // highlights take a little of the light tint
            var kR = SK[0] + (LI[0] - SK[0]) * hl, kG = SK[1] + (LI[1] - SK[1]) * hl, kB = SK[2] + (LI[2] - SK[2]) * hl;
            if (force >= 0) { bK = 0.85; kR = LC[0]; kG = LC[1]; kB = LC[2]; }
            B += (bK - B) * ws; A += (1 - A) * ws;
            cR += (kR - cR) * ws; cG += (kG - cG) * ws; cB += (kB - cB) * ws;
          }
        }

        if (inEye) {
          // catchlights: pure white, on top of iris and pupil
          if (catchOn) {
            var cu = (x - wX + (y - wY) * 0.12) / wHX, cv = (y - wY) / wHY, hit = false;
            if (cu > -1 && cu < 1 && cv > -1 && cv < 1) {
              hit = (cu > paneX || cu < -paneX) && (cv > paneY || cv < -paneY);
            } else {
              var ddx = x - dotX, ddy = y - dotY;
              hit = ddx * ddx + ddy * ddy < dotR;
            }
            if (hit) { B = 1; A = 1; cR = cG = cB = 255; }
          }
          // a nearly closed eye reads as one clean lash line
          if (closedK > 0) {
            var ck = closedK * eyeK;
            B += (0.86 - B) * ck;
            cR += (LN[0] - cR) * ck; cG += (LN[1] - cG) * ck; cB += (LN[2] - cB) * ck;
          }
        }

        // soft halo around the star
        if (m > 0.004 && rho >= 1 && rho < 1.3) {
          var hk = (1.3 - rho) / 0.3;
          hk = hk * hk * 0.55 * m;
          B += (0.55 - B) * hk; A += (1 - A) * hk;
          cR += (sR - cR) * hk; cG += (sG - cG) * hk; cB += (sB - cB) * hk;
        }

        // fade-in: characters appear in random order
        if (fading) A *= clamp01((fadeP - seed[i] * 0.72 - rowFade) / 0.3);

        // character + colour
        if (B < 0) B = 0; else if (B > 1) B = 1;
        var af = A * (0.3 + 0.7 * B) * scan;                                 // character alpha
        var ci = 0;
        if (af >= 0.012) {
          if (force >= 0) {
            ci = force;
          } else {
            if (Math.random() < reroll) jit[i] = (Math.random() - 0.5) * 0.16;   // +-0.08 brightness jitter
            var v = B + jit[i];
            ci = v <= 0 ? 0 : v >= 1 ? brightest : (v * brightest + 0.5) | 0;
          }
        }
        if (ci !== last[i]) {
          if (!gctx) {
            last[i] = ci;                                                    // WebGL: the shader reads this array
          } else {
            wanted++;
            if (odds >= 1 || Math.random() < odds) {                         // 2D: restamp the characters that changed
              last[i] = ci;
              gctx.drawImage(atlas, ci * cellW, 0, cellW, cellH, c * cellW, rowY, cellW, cellH);
            }
          }
        }
        tintPx[o] = cR * af;
        tintPx[o + 1] = cG * af;
        tintPx[o + 2] = cB * af;
      }
    }
  }

  /* ====================================================================
   * 12. DRAWING
   * ==================================================================== */

  /* ---- WebGL ---- */

  // the whole character grid in one pass (glitch slices and dissolved blocks included)
  function glFrame() {
    var g = gl, k, s, n = diss ? diss.slices.length : 0;
    g.useProgram(glS.frame);
    g.activeTexture(g.TEXTURE1);
    g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, cols, rows, g.LUMINANCE, g.UNSIGNED_BYTE, last);
    g.activeTexture(g.TEXTURE2);
    g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, cols, rows, g.RGBA, g.UNSIGNED_BYTE, tintBytes);
    for (k = 0; k < 4; k++) {
      s = k < n ? diss.slices[k] : null;
      sliceU[k * 4] = s ? s.y : -1;
      sliceU[k * 4 + 1] = s ? s.y + s.h : -1;
      sliceU[k * 4 + 2] = s ? s.dx : 0;
    }
    g.uniform4fv(glS.uSlice, sliceU);
    g.bindBuffer(g.ARRAY_BUFFER, glS.quad);
    g.enableVertexAttribArray(0);
    g.disableVertexAttribArray(1);
    g.disableVertexAttribArray(2);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  // queue one textured quad: position in pixels, sheet coordinates, premultiplied colour
  function quad(x0, y0, x1, y1, u0, v0, u1, v1, r, g, b, a) {
    if ((batchN + 1) * 48 > batch.length) {
      var bigger = new Float32Array(batch.length * 2);
      bigger.set(batch);
      batch = bigger;
    }
    var d = batch, o = batchN++ * 48, k;
    d[o] = x0; d[o + 1] = y0; d[o + 2] = u0; d[o + 3] = v0;
    d[o + 8] = x1; d[o + 9] = y0; d[o + 10] = u1; d[o + 11] = v0;
    d[o + 16] = x0; d[o + 17] = y1; d[o + 18] = u0; d[o + 19] = v1;
    d[o + 24] = x0; d[o + 25] = y1; d[o + 26] = u0; d[o + 27] = v1;
    d[o + 32] = x1; d[o + 33] = y0; d[o + 34] = u1; d[o + 35] = v0;
    d[o + 40] = x1; d[o + 41] = y1; d[o + 42] = u1; d[o + 43] = v1;
    for (k = o + 4; k < o + 48; k += 8) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a; }
  }

  // everything queued this frame (sparkles, falling pixels) in one draw call
  function glSprites() {
    var g = gl;
    if (!batchN) return;
    g.useProgram(glS.sprite);
    g.bindBuffer(g.ARRAY_BUFFER, glS.batch);
    g.bufferData(g.ARRAY_BUFFER, batch.subarray(0, batchN * 48), g.DYNAMIC_DRAW);
    g.enableVertexAttribArray(0);
    g.enableVertexAttribArray(1);
    g.enableVertexAttribArray(2);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 32, 0);
    g.vertexAttribPointer(1, 2, g.FLOAT, false, 32, 8);
    g.vertexAttribPointer(2, 4, g.FLOAT, false, 32, 16);
    g.enable(g.BLEND);
    g.drawArrays(g.TRIANGLES, 0, batchN * 6);
    g.disable(g.BLEND);
    batchN = 0;
  }

  /* ---- 2D fallback ---- */

  // grey characters x colour map + background colour
  function paint(dx) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(glyphs, dx, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tint, 0, 0, cols, rows, dx, 0, cols * cellW, rows * cellH);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillRect(dx, 0, CW, CH);
  }

  function frame2D() {
    var k, s, n = diss ? diss.slices.length : 0;
    tctx.putImageData(tintImg, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BG_CSS;
    paint(0);
    for (k = 0; k < n; k++) {                    // glitch slices: repaint a strip shifted sideways, wrapped around
      s = diss.slices[k];
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, s.y, CW, s.h);
      ctx.clip();
      if (s.dx > 0) { paint(s.dx - CW); paint(s.dx); } else { paint(s.dx); paint(s.dx + CW); }   // left copy first
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // clear the blocks that are gone, so the website shows through
  function punch2D() {
    var d = diss;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(d.mask, 0, 0, d.bc, d.br, 0, 0, d.bc * d.bs, d.br * d.bs);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- shared: one sprite, one square ---- */

  function putSprite(sp, x, y, size, alpha) {
    if (gl) {
      quad(x, y, x + size, y + size, sp.u0, sp.v0, sp.u1, sp.v1, alpha, alpha, alpha, alpha);
    } else {
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp.img, x, y, size, size);
    }
  }

  function putSquare(p, x, y, alpha) {
    if (gl) {
      quad(x, y, x + p.s, y + p.s, whiteU, whiteV, whiteU, whiteV, p.r * alpha, p.g * alpha, p.b * alpha, alpha);
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.css;
      ctx.fillRect(x, y, p.s, p.s);
    }
  }

  /* ====================================================================
   * 13. SPARKLES
   * ==================================================================== */

  // about one sparkle per 8000 px2, sizes 7..55 px, mostly small
  function makeSparkles() {
    var n = clamp(Math.round(W * H / 8000), 6, 1600), k, u;
    sparkles = [];
    for (k = 0; k < n; k++) {
      u = Math.random();
      sparkles.push({
        x: Math.random(), y: Math.random(),           // position as a fraction of the screen
        size: 7 + 48 * Math.pow(u, 3.2),
        born: Math.random() * 0.6 * D_SPARK,          // seconds into the sparkle phase
        rate: 4 + Math.random() * 5,
        ph: Math.random() * 6.2832,
        delay: Math.random() * 0.1,                   // when the dissolve reaches it
        dead: false
      });
    }
  }

  function drawSparkles(ts, tw) {
    var ps = ts - T_SPARK, k, s, age, pop, size, alpha, wk, set, D, x, y;
    if (ps <= 0) return;
    if (ctx) { ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true; }
    for (k = 0; k < sparkles.length; k++) {
      s = sparkles[k];
      age = ps - s.born;
      if (s.dead || age <= 0) continue;
      pop = age < 0.28 ? backOut(age / 0.28) : 1;
      size = s.size * pop * (0.8 + 0.2 * Math.sin(tw * s.rate + s.ph));                          // twinkle: size
      alpha = (age < 0.1 ? age / 0.1 : 1) * (0.72 + 0.28 * Math.sin(tw * s.rate * 1.37 + s.ph * 1.9));   // ... and alpha
      wk = clamp01(age / 0.9);                                                                   // accent -> white
      set = stars.length === 1 || size > 24 ? stars[0] : size > 10 ? stars[1] : stars[2];
      D = size * dpr * set.white.grow;
      x = s.x * CW - D / 2;
      y = s.y * CH - D / 2;
      if (wk < 1) putSprite(set.accent, x, y, D, alpha * (1 - wk));
      if (wk > 0) putSprite(set.white, x, y, D, alpha * wk);
    }
    if (ctx) ctx.globalAlpha = 1;
  }

  /* ====================================================================
   * 14. DISSOLVE
   * ==================================================================== */

  function beginDissolve() {
    var bs = Math.round(12 * dpr);               // 12 px blocks
    var bc = Math.ceil(CW / bs), br = Math.ceil(CH / bs), n = bc * br;
    var dist = new Float32Array(n), delay = new Float32Array(n), gone = new Uint8Array(n);
    var cap = 170 * dpr, i, k, s, mask = null, mctx = null;

    // Weighted distance from every block to its nearest star. A faster "eater" reaches further.
    function eat(px, py, speed) {
      var reach = cap * speed, bx, by, ex, ey, d, row;
      var x0 = Math.max(0, Math.floor((px - reach) / bs)), x1 = Math.min(bc - 1, Math.floor((px + reach) / bs));
      var y0 = Math.max(0, Math.floor((py - reach) / bs)), y1 = Math.min(br - 1, Math.floor((py + reach) / bs));
      for (by = y0; by <= y1; by++) {
        ey = (by + 0.5) * bs - py;
        row = by * bc;
        for (bx = x0; bx <= x1; bx++) {
          ex = (bx + 0.5) * bs - px;
          d = Math.sqrt(ex * ex + ey * ey) / speed;
          if (d < dist[row + bx]) dist[row + bx] = d;
        }
      }
    }
    for (i = 0; i < n; i++) dist[i] = cap;
    for (k = 0; k < sparkles.length; k++) {
      s = sparkles[k];
      eat(s.x * CW, s.y * CH, 1 + 1.4 * (s.size - 7) / 48);      // bigger sparkles eat faster
    }
    eat(cx, cy, 3);                                              // and so does the big star in the middle

    // delay = distance (as a share of the 96th percentile, so a few stragglers
    // do not stretch the whole thing) + 15% random noise
    var hist = new Uint32Array(64), sum = 0, ref = cap;
    for (i = 0; i < n; i++) hist[Math.min(63, (dist[i] / cap * 64) | 0)]++;
    for (k = 0; k < 64; k++) {
      sum += hist[k];
      if (sum >= n * 0.96) { ref = (k + 1) / 64 * cap; break; }
    }
    for (i = 0; i < n; i++) delay[i] = Math.min(1, dist[i] / ref) * 0.85 + Math.random() * 0.15;

    // one mask pixel per block: the shader (or the 2D canvas) cuts the holes with it
    if (gl) {
      gl.activeTexture(gl.TEXTURE3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, bc, br, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, gone);
      gl.useProgram(glS.frame);
      gl.uniform2f(glS.uMaskSize, bc * bs, br * bs);
    } else {
      mask = newCanvas(bc, br);
      mctx = mask.getContext('2d');
    }

    diss = {
      t0: clock, skipped: wantSkip, sceneT: clock,
      bs: bs, bc: bc, br: br, count: n, cleared: 0, delay: delay, gone: gone,
      mask: mask, mctx: mctx, mimg: mctx ? mctx.createImageData(bc, br) : null,
      slices: [], glitchAt: -1e9, wiped: false
    };
    wantSkip = false;

    // From here on the page underneath is live again: clicks pass through and it can
    // scroll. The canvas keeps its pixel size, so a returning scrollbar cannot squeeze it.
    removeSkipListeners();
    var st = canvas.style;
    st.setProperty('pointer-events', 'none', 'important');
    st.setProperty('right', 'auto', 'important');
    st.setProperty('bottom', 'auto', 'important');
    st.setProperty('width', W + 'px', 'important');
    st.setProperty('height', H + 'px', 'important');
    unlockScroll();
  }

  function addParticle(x, y, vx, vy, size, r, g, b, alpha, life, glow) {
    particles.push({
      x: x, y: y, vx: vx, vy: vy, s: Math.max(1, Math.round(size)),
      r: r / 255, g: g / 255, b: b / 255, css: gl ? '' : 'rgb(' + r + ',' + g + ',' + b + ')',
      a: alpha, age: 0, life: life, glow: glow
    });
  }

  // A block's turn has come: if it was bright, it falls out as a pixel square in its own colour.
  function spawnBlock(i) {
    var d = diss, bs = d.bs, bx = (i % d.bc) * bs, by = ((i / d.bc) | 0) * bs;
    var c = Math.min(cols - 1, ((bx + bs / 2) / cellW) | 0), r = Math.min(rows - 1, ((by + bs / 2) / cellH) | 0);
    var o = (r * cols + c) * 4, R = tintPx[o], G = tintPx[o + 1], B = tintPx[o + 2];
    var lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
    if (lum <= 0.32 || particles.length > 24000) return;

    var boost = Math.min(2, 240 / Math.max(R, G, B)), alpha = Math.min(1, 0.5 + lum * 0.7), k, q, size;
    R = Math.round(R * boost); G = Math.round(G * boost); B = Math.round(B * boost);
    if (lum > 0.62 && particles.length < 16000) {     // very bright: four smaller squares
      q = bs / 4;
      size = bs * 0.34;
      for (k = 0; k < 4; k++) {
        addParticle(bx + (k & 1 ? 3 : 1) * q, by + (k & 2 ? 3 : 1) * q,
                    (Math.random() - 0.5) * 300 * dpr, -(40 + Math.random() * 200) * dpr, size, R, G, B, alpha, 1, null);
      }
    } else {
      // random sideways speed, upward kick
      addParticle(bx + bs / 2, by + bs / 2,
                  (Math.random() - 0.5) * 300 * dpr, -(40 + Math.random() * 200) * dpr, bs * 0.6, R, G, B, alpha, 1, null);
    }
  }

  // A sparkle has been reached: it bursts into small glowing white / accent squares.
  function burst(s) {
    var n = 4 + Math.round(s.size / 7), k, a, v, white, col;
    for (k = 0; k < n; k++) {
      a = Math.random() * 6.2832;
      v = (50 + Math.random() * 230) * dpr * (0.6 + s.size / 55);
      white = Math.random() < 0.6;
      col = white ? [255, 255, 255] : AC;
      addParticle(s.x * CW, s.y * CH, Math.cos(a) * v, Math.sin(a) * v - 90 * dpr, (2 + Math.random() * 2.5) * dpr,
                  col[0], col[1], col[2], 1, 0.55 + Math.random() * 0.45, white ? glowWhite : glowAccent);
    }
  }

  function dissolveStep(now, pl) {
    var d = diss, p = pl, n = d.count, i, k, dirty = false, count;   // delays are plain time: fronts spread at a steady pace

    if (!classAdded && pl >= 0.25) markLoaded();      // site intro animations can start now

    // blocks whose turn has come (their colour is read from the frame that is still on screen)
    if (d.cleared < n) {
      var gone = d.gone, delay = d.delay, mpx = d.mimg ? d.mimg.data : null;
      for (i = 0; i < n; i++) {
        if (gone[i] === 0 && delay[i] <= p) {
          gone[i] = 255;
          d.cleared++;
          if (mpx) mpx[i * 4 + 3] = 255;
          dirty = true;
          spawnBlock(i);
        }
      }
      if (dirty) {
        if (gl) {
          gl.activeTexture(gl.TEXTURE3);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, d.bc, d.br, gl.LUMINANCE, gl.UNSIGNED_BYTE, gone);
        } else {
          d.mctx.putImageData(d.mimg, 0, 0);
        }
      }
    }

    for (k = 0; k < sparkles.length; k++) {
      if (!sparkles[k].dead && sparkles[k].delay <= p) {
        sparkles[k].dead = true;
        burst(sparkles[k]);
      }
    }

    // glitch: during the first 60%, a few horizontal slices shifted sideways, re-rolled every 70 ms
    if (pl >= 0.6) {
      d.slices.length = 0;
    } else if (now - d.glitchAt > 70) {
      d.glitchAt = now;
      d.slices.length = 0;
      count = Math.random() < 0.2 ? 0 : 1 + ((Math.random() * 3.4) | 0);
      for (k = 0; k < count; k++) {
        d.slices.push({
          y: (Math.random() * CH) | 0,
          h: Math.max(2, ((4 + Math.random() * 38) * dpr) | 0),
          dx: ((Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 60) * dpr * (0.35 + 0.65 * (1 - pl / 0.6))) | 0
        });
      }
    }
  }

  // falling pixels: gravity 900 px/s2, fading out over their lifetime
  function drawParticles(dt) {
    var grav = 900 * dpr, n = particles.length, keep = 0, i, p, alpha, D;
    if (ctx) { ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true; }
    for (i = 0; i < n; i++) {
      p = particles[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > CH + 40 * dpr) continue;
      particles[keep++] = p;
      alpha = p.a * (1 - p.age / p.life);
      if (p.glow) {
        D = p.s * p.glow.grow;
        putSprite(p.glow, p.x - D / 2, p.y - D / 2, D, alpha);
      }
      putSquare(p, (p.x - p.s / 2) | 0, (p.y - p.s / 2) | 0, alpha);
    }
    particles.length = keep;
    if (ctx) ctx.globalAlpha = 1;
  }

  /* ====================================================================
   * 15. FRAME LOOP
   * ==================================================================== */

  function frame(now) {
    rafId = 0;
    if (!running) return;
    try {
      // Clamped steps: a hidden tab pauses the loader, a busy page slows it down instead of skipping.
      var dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
      lastNow = now;

      if (needResize && !diss) { needResize = false; resize(); }

      clock += dt * SPEED;
      if (!diss && (wantSkip || clock >= T_DISS)) beginDissolve();

      var sceneT = diss && diss.skipped ? diss.sceneT : clock;   // a skip dissolves whatever was on screen
      var pl = 0, empty = false;
      if (diss) {
        pl = clamp01((clock - diss.t0) / D_DISS);
        dissolveStep(now, pl);
        empty = diss.cleared >= diss.count;                      // everything is gone, only pixels still fall
      }

      if (empty) {
        if (gl) gl.clear(gl.COLOR_BUFFER_BIT); else ctx.clearRect(0, 0, CW, CH);
      } else {
        shade(sceneT, clock, dt);
        if (gl) glFrame(); else frame2D();
      }
      if (!empty) drawSparkles(sceneT, clock);
      if (diss) {
        if (!gl && !empty) punch2D();
        drawParticles(dt * SPEED);
      }
      if (gl) glSprites();

      if (firstFrame) { firstFrame = false; uncover(); }
      if (diss && pl >= 1 && particles.length === 0) { finish(); return; }
      rafId = window.requestAnimationFrame(frame);
    } catch (err) {
      fail(err);
    }
  }

  /* ====================================================================
   * 16. PUBLIC API + BOOT
   * ==================================================================== */

  function reducedMotion() {
    try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function seenThisSession() {
    try { return window.sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  window.EyeLoader = {
    // play again, whatever the session flag says (reduced motion is still respected)
    replay: function () {
      if (reducedMotion()) {
        window.setTimeout(function () { announce(false); }, 0);
        return;
      }
      teardown();
      html.classList.remove(DONE_CLASS);
      start();
    },
    // jump straight to the dissolve
    skip: skip
  };

  if (reducedMotion() || (ONCE && seenThisSession())) {
    // Not playing: the page still gets its class and its event, so intros that wait for them run.
    markLoaded();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { announce(false); });
    } else {
      window.setTimeout(function () { announce(false); }, 0);
    }
  } else {
    if (ONCE) { try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {} }
    start();
  }
})(window, document);
