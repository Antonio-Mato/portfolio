/*!
 * eye-theme.js - the page-side half of eye-loader.js (vanilla JS, no dependencies, no build step)
 *
 * The loader draws an eye out of monospace characters, turns its iris into a
 * 4-point star and falls apart into pixels. This file keeps that world running
 * underneath the page the loader reveals, so the intro and the site read as one thing.
 *
 * FIELD     One fixed canvas behind the page: the loader's own character grid
 *           (same cells, same cloud noise, same ramp, same scanlines), so the
 *           backdrop of the intro never ends - it turns out to be the page's.
 *           Three things are drawn into it, all in screen space, so they move
 *           through the characters as the page scrolls:
 *             - the afterimage of the star, exactly where the loader left it (the hero)
 *             - a catchlight under the pointer
 *             - the eye, behind the name in the hero, watching the pointer:
 *               the star cools and closes back into it
 * DISSOLVE  The loader's 12 px block dissolve at element size: reveal(el) for
 *           things scrolling into view, swap(box, from, to) for slideshow frames.
 * DECODE    Text that arrives as ramp characters before it settles (the
 *           loader's fade-in): the name in the hero, the prices.
 * BURST     A few of the loader's falling pixel squares, under a pressed button.
 *
 * INSTALL   Load after the page markup and call EyeTheme.init() once the text
 *           is final (after translation). Everything degrades to the plain
 *           page: no WebGL -> no field, reduced motion -> one still frame.
 *
 * HOOKS     html.field-on      class present while the field is drawing
 *           window.EyeTheme    { init(), ready(fn), reveal(el, wait), swap(box, from, to), burst(x, y, n) }
 *                              ready(fn) runs fn once the loader has started to uncover the page
 *
 * The noise tables, the lid curves, the iris texture and the shading of the
 * eye are the loader's own, so both draw the same eye. Change one, change both.
 */
(function (window, document) {
  'use strict';

  if (window.EyeTheme) return;

  var html = document.documentElement;
  var reduce = false, touch = false;
  try {
    reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    touch = !!window.matchMedia && window.matchMedia('(hover: none)').matches;
  } catch (e) {}

  /* ====================================================================
   * 1. TUNING
   * ==================================================================== */

  var MAX_CELLS = 28000;      // the loader's limit: past it the characters grow instead
  var CLOUD = 1;              // background characters against the loader's at the hand-over (1 = identical, so there is no seam)
  var CLOUD_REST = 0.68;      // ... and once the star has cooled: a page of text wants a quieter ground than an intro does
  var CLOUD_RATE = 1.5;       // how often a background character re-rolls, per second (the loader: 12, far too restless to read over)
  var STAR_GROW = 0.25;       // how much wider the star's afterimage is than the star was (its lower tip just clears the fold)
  var PTR_R = 135;            // radius of the catchlight under the pointer, CSS px
  var BLOCK = 12;             // the loader's dissolve block, CSS px
  var COOL = 2.8;             // seconds the star takes to cool from white into its afterimage
  var SKIN_X = 0.5, SKIN_Y = 0.72;   // where the skin around the eye has faded out (eye units)
  var TEXT_DIM = 0.6;         // how far the eye behind the name dims under the letters (0 = not at all)
  var SCROLL_DIM = 0.38;      // how bright the eye stays once the hero has scrolled away, behind the rest of the page

  /* ====================================================================
   * 2. SHARED WITH THE LOADER: helpers, palette, noise, eye geometry
   * ==================================================================== */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function sstep(a, b, v) { var k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); }
  function mix(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
  function prng(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var v = Math.imul(a ^ (a >>> 15), 1 | a);
      v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
  }

  // dark -> bright
  var RAMP = " .`-':,_^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
  var RAMP_N = RAMP.length, TOP = RAMP_N - 1;
  var CH_PIPE = RAMP.indexOf('|'), CH_SLASH = RAMP.indexOf('/'), CH_BACK = RAMP_N;   // "\" is an extra atlas tile

  // the site's palette, in the roles the loader gives it
  var BG = [9, 9, 11];                 // --ink-900
  var AC = [59, 130, 246];             // --marker       iris
  var LI = [198, 213, 241];            // --chalk-tint   light iris
  var DP = [29, 78, 216];              // --marker-deep  deep iris
  var DK = [16, 38, 112];              //                pupil, limbal ring
  var SC = [228, 234, 245];            //                sclera
  var SK = [108, 127, 150];            // --chalk-faint  skin
  var LC = mix(DP, AC, 0.45);          // lashes
  var LN = mix(AC, LI, 0.30);          // the closed eye
  var ST = mix(AC, LI, 0.22);          // the star before it turns white
  var CA = mix(AC, LI, 0.40);          // caruncle
  var BGC = mix(SK, LI, 0.35);         // dim background characters
  var INK_CSS = 'rgb(9,9,11)', AC_CSS = 'rgb(59,130,246)';

  var EXP = null, NT = null, NP = null, IRIS = null, IRIS_RGB = null;
  var LASH_N = 0, LASH_EX = [], LASH_LEN = [], LASH_LEAN = [], LASH_CH = [];

  function fexp(v) { return v <= 0 ? 1 : v >= 8 ? 0 : EXP[(v * 128) | 0]; }

  // Same seeds, same order of draws as the loader: the clouds land in the same cells.
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
      mid = 1 - Math.min(1, Math.abs(ex - 0.25) / 0.95);
      lean = clamp((ex - 0.1) * 0.72 + (rnd() - 0.5) * 0.16, -0.7, 0.7);
      LASH_EX.push(ex);
      LASH_LEN.push(0.06 + 0.08 * (0.3 * rnd() + 0.7 * mid));
      LASH_LEAN.push(lean);
      LASH_CH.push(Math.abs(lean) * 1.5 < 0.36 ? CH_PIPE : lean < 0 ? CH_BACK : CH_SLASH);
      LASH_N++;
    }
  }

  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    var x0 = xi & 255, x1 = (xi + 1) & 255, y0 = yi & 255, y1 = (yi + 1) & 255;
    var a = NT[NP[NP[x0] + y0]], b = NT[NP[NP[x1] + y0]], c = NT[NP[NP[x0] + y1]], d = NT[NP[NP[x1] + y1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function vnoiseWrap(x, y, per) {
    var xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    var x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, y0 = yi & 255, y1 = (yi + 1) & 255;
    var a = NT[NP[NP[x0] + y0]], b = NT[NP[NP[x1] + y0]], c = NT[NP[NP[x0] + y1]], d = NT[NP[NP[x1] + y1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function ring(a, f, s) {
    var v = a * f, i0 = Math.floor(v), u = v - i0;
    u = u * u * (3 - 2 * u);
    var p0 = NT[((i0 % f) + s) & 255], p1 = NT[(((i0 + 1) % f) + s) & 255];
    return p0 + (p1 - p0) * u;
  }

  // lid heights above / below the corner-to-corner axis; ex = x / 0.86
  function lidUpper(ex) {
    var a = 1 - (ex - 0.1) * (ex - 0.1) / 1.05;
    return a > 0 ? 0.52 * Math.pow(a, 0.62) * (1 - 0.15 * (ex > 0 ? ex : 0)) : 0;
  }
  function lidLower(ex) {
    var a = 1 - (ex + 0.14) * (ex + 0.14) / 1.1;
    return a > 0 ? 0.34 * Math.pow(a, 0.8) : 0;
  }
  var CENTRE = (0.52 - 0.34) / 2;

  // the iris texture, baked once: angle (512 steps) x radius (64 steps)
  function buildIris() {
    var a, r, ang, rho, fib, wave, v, cd, k1, k2, k3, c;
    IRIS = new Float32Array(512 * 64);
    IRIS_RGB = new Float32Array(64 * 3);
    for (a = 0; a < 512; a++) {
      ang = (a + 0.5) / 512;
      fib = 0.5 * ring(ang, 31, 0) + 0.3 * ring(ang, 71, 40) + 0.2 * ring(ang, 149, 90);
      wave = 0.04 * (ring(ang, 9, 150) - 0.5);
      for (r = 0; r < 64; r++) {
        rho = (r + 0.5) / 64;
        v = 0.60 + 0.42 * fib;
        if (rho > 0.42 && rho < 0.9) {
          v *= 1 - 0.5 * sstep(0.58, 0.82, vnoiseWrap(ang * 36, rho * 5.5 + 2.7, 36)) *
               sstep(0.42, 0.55, rho) * (1 - sstep(0.76, 0.9, rho));
        }
        cd = (rho - 0.60 - wave) / 0.07;
        v += 0.24 * Math.exp(-cd * cd);
        v *= 1 - 0.9 * sstep(0.84, 0.99, rho);
        IRIS[a * 64 + r] = v;
      }
    }
    for (r = 0; r < 64; r++) {
      rho = (r + 0.5) / 64;
      k1 = sstep(0.40, 0.66, rho); k2 = sstep(0.70, 0.92, rho); k3 = sstep(0.92, 1, rho);
      c = mix(mix(mix(LI, AC, k1), DP, k2), DK, k3);
      IRIS_RGB[r * 3] = c[0]; IRIS_RGB[r * 3 + 1] = c[1]; IRIS_RGB[r * 3 + 2] = c[2];
    }
  }

  // gaze keyframes of the loader's look-around: fraction of the loop, x, y
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

  function glyphOf(v) { return v <= 0 ? 0 : v >= 1 ? TOP : (v * TOP + 0.5) | 0; }

  /* ====================================================================
   * 3. FIELD: state + WebGL
   *
   * The same single pass as the loader: three small textures (the ramp as an
   * atlas, which character per cell, which colour per cell) and one quad.
   * ==================================================================== */

  var canvas = null, gl = null, glS = null, fieldOn = false;
  var W = 0, H = 0, dpr = 1, CW = 0, CH = 0;    // CSS size, pixel ratio, backing-store size
  var viewW = 0, viewH = 0;                     // the viewport the loader measured itself against
  var cellW = 0, cellH = 0, cols = 0, rows = 0;

  var bgB, jit;                                 // per cell: cloud brightness, flicker
  var baseCh, baseTint;                         // per cell: the clouds alone
  var outCh, outTint, outBytes;                 // per cell: what is on screen this frame
  var colX, colYU, colYL, colDc, colUW, colLW, colEye;           // per column: lid geometry of the eye
  var lashX = [], lashY = [], lashH = [];

  var rafId = 0, lastDraw = 0, clock = 0, dirty = true, needResize = true, covered = false;

  var VS = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform sampler2D uAtlas,uChars,uTint;',
    'uniform vec2 uRes,uCell,uGrid,uAtlasSize;',
    'uniform vec3 uBg;',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',                    // pixel, origin top left
    '  vec2 cell=floor(p/uCell);',
    '  vec2 uv=(cell+.5)/uGrid;',
    '  float idx=floor(texture2D(uChars,uv).r*255.+.5);',                      // which character
    '  float glyph=texture2D(uAtlas,(vec2(idx*uCell.x,0.)+p-cell*uCell)/uAtlasSize).r;',
    '  gl_FragColor=vec4(texture2D(uTint,uv).rgb*glyph+uBg,1.);',              // character x colour + background
    '}'
  ].join('\n');

  function glTexture(g, unit) {
    var tx = g.createTexture();
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(g.TEXTURE_2D, tx);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return tx;
  }

  function initGL() {
    var g = null, p, src = [VS, FS], type, k, s, hp, buf;
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
    try {
      g = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!g) return false;
      hp = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
      if (!hp || !hp.precision || g.getParameter(g.MAX_TEXTURE_SIZE) < 4096) return false;

      p = g.createProgram();
      type = [g.VERTEX_SHADER, g.FRAGMENT_SHADER];
      for (k = 0; k < 2; k++) {
        s = g.createShader(type[k]);
        g.shaderSource(s, src[k]);
        g.compileShader(s);
        if (!g.getShaderParameter(s, g.COMPILE_STATUS)) return false;
        g.attachShader(p, s);
      }
      g.bindAttribLocation(p, 0, 'aPos');
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) return false;

      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      g.disable(g.DEPTH_TEST);
      g.disable(g.BLEND);
      glTexture(g, 0);                                          // atlas
      glTexture(g, 1);                                          // characters
      glTexture(g, 2);                                          // colours

      g.useProgram(p);
      g.uniform1i(g.getUniformLocation(p, 'uAtlas'), 0);
      g.uniform1i(g.getUniformLocation(p, 'uChars'), 1);
      g.uniform1i(g.getUniformLocation(p, 'uTint'), 2);
      g.uniform3f(g.getUniformLocation(p, 'uBg'), BG[0] / 255, BG[1] / 255, BG[2] / 255);

      buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);

      glS = {
        uRes: g.getUniformLocation(p, 'uRes'), uCell: g.getUniformLocation(p, 'uCell'),
        uGrid: g.getUniformLocation(p, 'uGrid'), uAtlasSize: g.getUniformLocation(p, 'uAtlasSize')
      };
      gl = g;
      return true;
    } catch (e) {
      gl = glS = null;
      return false;
    }
  }

  // every character of the ramp, white on black, one tile per character (the loader's atlas)
  function buildAtlas() {
    var n = RAMP_N + 1, raw = document.createElement('canvas'), atlas = document.createElement('canvas'), g, k;
    raw.width = atlas.width = n * cellW;
    raw.height = atlas.height = cellH;
    g = raw.getContext('2d');
    g.font = '600 ' + (11 * cellH / 12) + 'px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff';
    for (k = 0; k < n; k++) {
      g.save();
      g.beginPath();
      g.rect(k * cellW, 0, cellW, cellH);
      g.clip();
      g.fillText(k < RAMP_N ? RAMP.charAt(k) : '\\', k * cellW + cellW / 2, Math.round(cellH * 0.79));
      g.restore();
    }
    g = atlas.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, atlas.width, cellH);
    g.drawImage(raw, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.uniform2f(glS.uAtlasSize, atlas.width, atlas.height);
    raw.width = raw.height = atlas.width = atlas.height = 0;
  }

  // How bright the clouds are. Full, like the loader's, while the star is still
  // hot; quieter once it has cooled. The colour of every cloud cell follows.
  var gain = -1, baseA = 0.5;
  function gainWanted() { return lerp(CLOUD_REST, CLOUD, star.heat); }
  function setGain(g) {
    if (Math.abs(g - gain) < 0.003) return;
    var n = cols * rows, i, o, af;
    gain = g;
    baseA = 0.5 * g;
    for (i = 0, o = 0; i < n; i++, o += 4) {
      af = baseA * (0.3 + 0.7 * bgB[i]) * ((((i / cols) | 0) & 1) ? 0.84 : 1);        // odd rows 16% dimmer: scanlines
      baseTint[o] = BGC[0] * af;
      baseTint[o + 1] = BGC[1] * af;
      baseTint[o + 2] = BGC[2] * af;
    }
  }

  // Runs on the first frame and after every resize. Returns false when nothing changed.
  function resize(force) {
    var rect = canvas.getBoundingClientRect(), n, i, o, r, c, v, B;
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    var d = clamp(window.devicePixelRatio || 1, 1, 2);
    d = Math.min(d, Math.sqrt(16e6 / (w * h)));

    // The loader sized itself against the window. A phone's address bar moves the
    // height while scrolling; that is not a resize, so only a new width counts there.
    var vw = window.innerWidth || w, vh = window.innerHeight || h;
    if (!viewH || !touch || vw !== viewW) viewH = vh;
    viewW = vw;

    if (!force && w === W && h === H && d === dpr) return false;
    W = w; H = h; dpr = d;
    CW = Math.round(W * dpr);
    CH = Math.round(H * dpr);
    canvas.width = CW;
    canvas.height = CH;

    // 8 x 12 CSS pixels per character, snapped to whole device pixels: the loader's rule
    var grow = Math.max(1, Math.sqrt(viewW * viewH / 96 / MAX_CELLS));
    var cw = Math.max(2, Math.round(8 * dpr * grow)), ch = Math.max(3, Math.round(12 * dpr * grow));
    var newCells = force || cw !== cellW || ch !== cellH;
    cellW = cw;
    cellH = ch;
    cols = Math.ceil(CW / cellW);
    rows = Math.ceil(CH / cellH);
    n = cols * rows;

    bgB = new Float32Array(n);
    jit = new Float32Array(n);
    baseCh = new Uint8Array(n);
    baseTint = new Uint8ClampedArray(n * 4);
    outCh = new Uint8Array(n);
    outTint = new Uint8ClampedArray(n * 4);
    outBytes = new Uint8Array(outTint.buffer);
    colX = new Float32Array(cols); colYU = new Float32Array(cols); colYL = new Float32Array(cols);
    colDc = new Float32Array(cols); colUW = new Float32Array(cols); colLW = new Float32Array(cols);
    colEye = new Uint8Array(cols);

    // the clouds: the loader's formula, cell for cell
    for (r = 0, i = 0, o = 0; r < rows; r++) {
      for (c = 0; c < cols; c++, i++, o += 4) {
        v = vnoise(c * 0.085 + 11, r * 0.125 + 5);
        B = 0.015 + 0.11 * v * v;
        bgB[i] = B;
        jit[i] = (Math.random() - 0.5) * 0.16;
        baseTint[o + 3] = 255;
        baseCh[i] = glyphOf(B + jit[i]);
      }
    }
    gain = -1;
    setGain(gainWanted());

    gl.viewport(0, 0, CW, CH);
    gl.uniform2f(glS.uRes, CW, CH);
    gl.uniform2f(glS.uCell, cellW, cellH);
    gl.uniform2f(glS.uGrid, cols, rows);
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, baseCh);
    gl.activeTexture(gl.TEXTURE2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, outBytes);
    if (newCells) buildAtlas();
    return true;
  }

  function draw() {
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, outCh);
    gl.activeTexture(gl.TEXTURE2);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, outBytes);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ====================================================================
   * 4. FIELD: what is drawn into it
   * ==================================================================== */

  /* ---- the catchlight under the pointer ---- */

  var ptr = { x: -1e5, y: -1e5, seen: false, on: 0, k: 0, want: 0, moved: 0 };
  var ptrX = 0, ptrY = 0, ptrInvR2 = 0, ptrK = 0;               // this frame, device pixels

  function ptrAt(x, y) {
    if (ptrK <= 0.004) return 0;
    var dx = x - ptrX, dy = y - ptrY, d2 = (dx * dx + dy * dy) * ptrInvR2;
    if (d2 >= 1) return 0;
    d2 = 1 - d2;
    return d2 * d2 * ptrK;
  }

  function layerPointer(dt) {
    var pr = PTR_R * dpr, reroll = 1 - Math.exp(-8 * dt);
    var c0 = Math.max(0, Math.floor((ptrX - pr) / cellW)), c1 = Math.min(cols - 1, Math.floor((ptrX + pr) / cellW));
    var r0 = Math.max(0, Math.floor((ptrY - pr) / cellH)), r1 = Math.min(rows - 1, Math.floor((ptrY + pr) / cellH));
    var r, c, i, o, k, B, af, scan;
    for (r = r0; r <= r1; r++) {
      scan = (r & 1) ? 0.84 : 1;
      for (c = c0; c <= c1; c++) {
        k = ptrAt((c + 0.5) * cellW, (r + 0.5) * cellH);
        if (k <= 0) continue;
        i = r * cols + c; o = i * 4;
        B = bgB[i] + 0.2 * k;
        af = (baseA + 0.38 * k) * (0.3 + 0.7 * B) * scan;
        if (Math.random() < reroll) jit[i] = (Math.random() - 0.5) * 0.16;
        outCh[i] = glyphOf(B + jit[i]);
        outTint[o] = lerp(BGC[0], ST[0], k) * af;
        outTint[o + 1] = lerp(BGC[1], ST[1], k) * af;
        outTint[o + 2] = lerp(BGC[2], ST[2], k) * af;
      }
    }
  }

  /* ---- the star's afterimage (hero) ----
     The loader ends on a white 4-point star in the middle of the screen. The
     field holds the same star in the same place, so the dissolve reveals it
     rather than replacing it; then it cools into a blue outline with a hollow
     core, and the name stands where the core was. It belongs to the hero and
     scrolls away with it, through the characters. */

  var star = { el: null, vis: false, x: 0, y: 0, R: 0, heat: 0, hold: false, t0: -1, cooling: false,
               parts: [], tOn: false, tx0: 0, ty0: 0, tx1: 0, ty1: 0, show: 1 };

  function layerStar(tw, dt) {
    var sx = star.x, sy = star.y, heat = star.heat, cool = 1 - heat;
    // the loader's pulse, slowed once it has cooled; and as it cools it spreads, the way an afterimage does
    var R = star.R * (1 + STAR_GROW * cool) * (1 + 0.012 * Math.sin(tw * (1.1 + 5.9 * heat)));
    var padX = cellW / 2, padY = cellH / 2;                                    // keeps the thin tips one continuous line
    var RB = R * 1.3, sRB = Math.sqrt(RB), invR = 1 / R;
    var r0 = Math.max(0, Math.floor((sy - RB - padY) / cellH)), r1 = Math.min(rows - 1, Math.ceil((sy + RB + padY) / cellH));
    var reroll = 1 - Math.exp(-(3 + 9 * heat) * dt);
    var tm = 56 * dpr, show = lerp(star.show, 1, heat);
    var r, c, c0, c1, i, o, x, y, a, b, sb, amax, s, rho, B, A, cR, cG, cB, e, k, hk, keep, ddx, ddy, dd, pk, af, scan;
    var hR, hG, hB;

    for (r = r0; r <= r1; r++) {
      y = (r + 0.5) * cellH;
      b = Math.abs(y - sy) - padY;
      sb = b > 0 ? Math.sqrt(b) : 0;
      if (sb >= sRB) continue;
      amax = sRB - sb; amax = amax * amax + padX;                // how far this row reaches sideways
      c0 = Math.max(0, Math.floor((sx - amax) / cellW));
      c1 = Math.min(cols - 1, Math.ceil((sx + amax) / cellW));
      scan = (r & 1) ? 0.84 : 1;
      for (c = c0; c <= c1; c++) {
        x = (c + 0.5) * cellW;
        a = Math.abs(x - sx) - padX;
        s = (a > 0 ? Math.sqrt(a) : 0) + sb;
        rho = s * s * invR;                                      // 1 = the edge of the star (superellipse, exponent 0.5)
        if (rho >= 1.3) continue;
        i = r * cols + c; o = i * 4;

        B = bgB[i]; A = baseA; cR = BGC[0]; cG = BGC[1]; cB = BGC[2];

        // the cooled star steps back from the words: the name stands where its core was
        keep = show;
        if (star.tOn && cool > 0) {
          ddx = x < star.tx0 ? star.tx0 - x : x > star.tx1 ? x - star.tx1 : 0;
          ddy = y < star.ty0 ? star.ty0 - y : y > star.ty1 ? y - star.ty1 : 0;
          dd = ddx > ddy ? ddx : ddy;
          if (dd < tm) { dd = 1 - dd / tm; keep *= 1 - 0.94 * cool * dd * dd * (3 - 2 * dd); }
        }

        if (rho < 1) {
          e = sstep(0.4, 1, rho);                                // 0 in the core, 1 on the edge
          k = keep;
          B += (lerp(0.12 + 0.4 * e, 0.55 + 0.45 * sstep(1, 0.9, rho), heat) - B) * k;
          A += (lerp(0.18 + 0.54 * e, 1, heat) - A) * k;
          hR = lerp(lerp(ST[0], LI[0], 0.45 * e), 255, heat);
          hG = lerp(lerp(ST[1], LI[1], 0.45 * e), 255, heat);
          hB = lerp(lerp(ST[2], LI[2], 0.45 * e), 255, heat);
          cR += (hR - cR) * k; cG += (hG - cG) * k; cB += (hB - cB) * k;
        } else {
          hk = (1.3 - rho) / 0.3;                                // soft halo
          hk = hk * hk * 0.55 * lerp(0.7, 1, heat) * keep;
          B += (0.55 - B) * hk; A += (1 - A) * hk;
          cR += (lerp(ST[0], 255, heat) - cR) * hk;
          cG += (lerp(ST[1], 255, heat) - cG) * hk;
          cB += (lerp(ST[2], 255, heat) - cB) * hk;
        }

        pk = ptrAt(x, y) * cool;                                 // the pointer's light still shows inside it
        if (pk > 0) {
          B += 0.2 * pk; A += (1 - A) * 0.38 * pk;
          cR += (ST[0] - cR) * pk * 0.6; cG += (ST[1] - cG) * pk * 0.6; cB += (ST[2] - cB) * pk * 0.6;
        }

        if (B > 1) B = 1;
        af = A * (0.3 + 0.7 * B) * scan;
        if (Math.random() < reroll) jit[i] = (Math.random() - 0.5) * 0.16;
        outCh[i] = glyphOf(B + jit[i]);
        outTint[o] = cR * af;
        outTint[o + 1] = cG * af;
        outTint[o + 2] = cB * af;
      }
    }
  }

  /* ---- the eye (hero, behind the name) ----
     The loader's eye at rest: lids, sclera, iris, pupil, catchlights, lashes,
     skin. Shading copied from the loader with the zoom, morph and fade removed. */

  var eye = { el: null, near: false, vis: false, x: 0, y: 0, U: 1, gx: 0, gy: 0, open: 1,
              blinkAt: 0, blinkT: -1, hover: 0, hoverTo: 0, idle: 0,
              hero: false, wake: 1, bgK: 1, text: [], tN: 0, tr: new Float32Array(16) };   // tr: the words in front of it, as rects

  // a fixed random number per cell, so the eye switches on character by character as it wakes
  function cellRand(i) { return (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296; }

  function layerEye(tw, dt) {
    var U = eye.U, invU = 1 / U, gx = eye.gx, gy = eye.gy, ecx = eye.x, ecy = eye.y;
    var wake = eye.wake, on = wake * 1.5;                        // waking: the lids open the loader's way, the cells arrive a few at a time
    var open = Math.min(eye.open, 0.04 + 0.96 * ease(wake));
    var tm = 40 * dpr, tN = TEXT_DIM > 0 ? eye.tN : 0, tr = eye.tr, bgK = eye.bgK;
    var R = 0.37;
    var pupil = (0.39 + 0.07 * eye.hover) * (1 + 0.045 * Math.sin(tw * 1.7));  // share of the iris radius; widens when hovered
    var lift = 1 + 0.7 * Math.max(0, -gy);                       // the upper lid lifts when looking up
    var closedK = 1 - sstep(0.05, 0.3, open);                    // 1 = the eye is just a line
    var creaseK = sstep(0.15, 0.7, open);
    var lashK = 0.2 + 0.8 * sstep(0.1, 0.8, open);
    var centre = CENTRE * open;
    var cellWu = cellW * invU, cellHu = cellH * invU, halfW = cellWu / 2;
    var invSX = 1 / (SKIN_X * SKIN_X), invSY = 1 / (SKIN_Y * SKIN_Y);
    var wetH = Math.max(0.018, cellHu);
    var reroll = 1 - Math.exp(-12 * dt);

    // catchlights: a 4-pane "window" upper left of the iris, a tiny dot lower right
    var wX = gx * 0.86 - 0.125, wY = gy * 0.86 - 0.145, wHX = 0.058, wHY = 0.066;
    var paneX = wHX * U > 2.2 * cellW ? Math.max(0.11, halfW / wHX) : 0;
    var paneY = wHY * U > 2.2 * cellH ? Math.max(0.11, cellHu / 2 / wHY) : 0;
    var dotX = gx * 0.86 + 0.15, dotY = gy * 0.86 + 0.17, dotR = Math.max(0.026, 0.55 * cellHu);
    dotR *= dotR;

    var c0 = Math.max(0, Math.floor((ecx - (0.75 + SKIN_X) * U) / cellW));
    var c1 = Math.min(cols - 1, Math.ceil((ecx + (0.75 + SKIN_X) * U) / cellW));
    var r0 = Math.max(0, Math.floor((ecy - SKIN_Y * U) / cellH));
    var r1 = Math.min(rows - 1, Math.ceil((ecy + SKIN_Y * U) / cellH));
    if (c0 > c1 || r0 > r1) return;
    var c, r, k, i, o;

    /* ---- lids, once per column ---- */
    for (c = c0; c <= c1; c++) {
      var x0 = ((c + 0.5) * cellW - ecx) * invU, ex = x0 / 0.86, tilt = 0.06 * ex;    // outer corner sits higher
      var up = lidUpper(ex), lo = lidLower(ex);
      var yu0 = -tilt - up * open * lift + centre, yl0 = -tilt + lo * open + centre;
      if (up + lo > 0 && yl0 - yu0 < cellHu) {                   // never thinner than one character row
        var midY = (yu0 + yl0) / 2;
        yu0 = midY - cellHu / 2;
        yl0 = midY + cellHu / 2;
      }
      colX[c] = x0;
      colYU[c] = yu0;
      colYL[c] = yl0;
      colEye[c] = up + lo > 0 ? 1 : 0;
      colUW[c] = sstep(0, 0.16, up);
      colLW[c] = sstep(0, 0.12, lo);
      colDc[c] = Math.max(0.03, yu0 - (-tilt - up * lift + CENTRE) + 0.045 + 0.065 * sstep(0, 0.3, up));
    }

    /* ---- lash roots ---- */
    for (k = 0; k < LASH_N; k++) {
      lashX[k] = LASH_EX[k] * 0.86;
      lashY[k] = -0.06 * LASH_EX[k] - lidUpper(LASH_EX[k]) * open * lift + centre;
      lashH[k] = LASH_LEN[k] * lashK;
    }

    /* ---- every cell inside the skin ---- */
    for (r = r0; r <= r1; r++) {
      var y = ((r + 0.5) * cellH - ecy) * invU;
      var scan = (r & 1) ? 0.84 : 1;
      var qy = y * y * invSY;
      var dy = y - gy, ady = dy < 0 ? -dy : dy;
      i = r * cols + c0; o = i * 4;

      for (c = c0; c <= c1; c++, i++, o += 4) {
        var x = colX[c], ax = x < 0 ? -x : x;
        var hx = ax - 0.75, q = (hx > 0 ? hx * hx * invSX : 0) + qy;         // 1 = skin fully faded
        if (q >= 1) continue;                                                // the field stays as it is
        if (on < 1 && cellRand(i) >= on) continue;                          // not awake here yet

        var B = bgB[i], A = baseA, cR = BGC[0], cG = BGC[1], cB = BGC[2];
        var force = -1;
        var yu = colYU[c], yl = colYL[c];
        var inEye = colEye[c] === 1 && y > yu && y < yl;

        var dx = x - gx, adx = dx < 0 ? -dx : dx, rho = 9;                   // distance from the iris centre in iris radii
        if (adx < R && ady < R) rho = Math.sqrt(dx * dx + dy * dy) / R;

        if (rho < 1 && inEye) {
          /* ---------------- iris ---------------- */
          var ri = (rho * 64) | 0;
          var ib = IRIS[((Math.atan2(dy, dx) * 81.4873308631 + 256) & 511) * 64 + ri];   // fibres, crypts, collarette, limbal ring
          ib *= 0.66 + 0.34 * sstep(pupil, pupil + 0.14, rho);               // darker zone next to the pupil
          ib *= 1 + 0.22 * dy / R;                                           // lit from above: lower half lighter
          ib *= 1 - 0.76 * fexp((y - yu) / 0.10);                            // deep shadow of the upper lid and lashes
          var iR = IRIS_RGB[ri * 3], iG = IRIS_RGB[ri * 3 + 1], iB = IRIS_RGB[ri * 3 + 2];
          var pk = sstep(pupil + 0.02, pupil - 0.03, rho);                   // pupil
          if (pk > 0) {
            ib += (0.012 - ib) * pk;
            iR += (DK[0] - iR) * pk; iG += (DK[1] - iG) * pk; iB += (DK[2] - iB) * pk;
          }
          B = ib; cR = iR; cG = iG; cB = iB; A = 1;

        } else if (inEye) {
          /* ---------------- sclera ---------------- */
          var dU = y - yu, dL = yl - y;
          var bS = 0.92 - 0.42 * sstep(0.15, 1, ax);                         // a sphere: darker toward the corners
          var di = Math.sqrt(dx * dx + dy * dy) - R;
          bS += 0.09 * fexp(di * di * 33);                                   // brighter bulge around the iris
          bS *= 1 - 0.76 * fexp(dU / 0.085);                                 // heavy shadow under the upper lid
          bS *= 1 - 0.36 * fexp(dL / 0.045);                                 // soft shadow above the lower lid
          var vein = 0;
          if (ax > 0.3) {                                                    // faint veins, more toward the corners
            vein = vnoise(x * 4.5 + 31, y * 12 + 7) * 2 - 1;
            if (vein < 0) vein = -vein;
            vein = (1 - sstep(0.01, 0.07, vein)) * sstep(0.3, 0.8, ax);
            bS *= 1 - 0.22 * vein;
          }
          var tk = 0.05 + 0.30 * sstep(0.4, 1, ax) + 0.4 * vein;             // corners pick up the accent
          var eR = SC[0] + (AC[0] - SC[0]) * tk, eG = SC[1] + (AC[1] - SC[1]) * tk, eB = SC[2] + (AC[2] - SC[2]) * tk;

          if (x < -0.78) {                                                   // caruncle at the inner corner
            var car = sstep(-0.78, -0.9, x);
            bS += (0.42 + 0.25 * vnoise(x * 38, y * 38) - bS) * car;
            eR += (CA[0] - eR) * car; eG += (CA[1] - eG) * car; eB += (CA[2] - eB) * car;
          }
          if (dL < wetH) {                                                   // wet highlight along the lower lid
            var wet = sstep(1.05, 0.5, ax) * (0.45 + 0.55 * vnoise(x * 8 + 2, 3.5));
            bS += (1 - bS) * wet;
            eR += (255 - eR) * wet; eG += (255 - eG) * wet; eB += (255 - eB) * wet;
          }
          B = bS; A = 1; cR = eR; cG = eG; cB = eB;

        } else {
          /* ---------------- skin: lids, crease, brow, cheek ---------------- */
          var ws = 1 - sstep(0.55, 1, q);                                    // fades smoothly into the field
          var bK, d;
          if (y <= yu) {
            d = yu - y;
            var Dc = colDc[c], uw = colUW[c];
            if (d < Dc) {
              bK = lerp(0.19, 0.18 + 0.31 * Math.sin(3.14159265 * d / Dc), uw);       // convex lid: lighter in the middle
            } else {
              var eb = (d - Dc - 0.10) / 0.085;
              bK = 0.14 + 0.33 * fexp(eb * eb);                              // brow-bone highlight
            }
            var ec = (d - Dc) / 0.028;
            bK *= 1 - 0.7 * creaseK * uw * fexp(ec * ec);                    // lid crease
            bK *= 1 - 0.88 * uw * (1 - sstep(0.012, 0.045, d));              // dark lash-base band

            if (d < 0.16 && ws > 0.15) {                                     // lashes: "\", "|" and "/" leaning outward
              for (k = 0; k < LASH_N; k++) {
                var lx = x - lashX[k];
                if (lx > 0.12 || lx < -0.12) continue;
                var lh = lashY[k] - y;
                if (lh < 0 || lh > lashH[k]) continue;
                lx -= LASH_LEAN[k] * lh;
                if (lx < halfW && lx >= -halfW) { force = LASH_CH[k]; break; }
              }
            }
          } else {
            d = y - yl;                                                      // under the eye: darker near the lid
            bK = lerp(0.19, 0.11 + 0.25 * sstep(0, 0.14, d) + 0.07 * fexp(d / 0.02), colLW[c]);
          }
          bK *= 0.84 + 0.32 * vnoise(x * 10 + 5, y * 10 + 9);
          var hl = sstep(0.22, 0.5, bK) * 0.35;                              // highlights take a little of the light tint
          var kR = SK[0] + (LI[0] - SK[0]) * hl, kG = SK[1] + (LI[1] - SK[1]) * hl, kB = SK[2] + (LI[2] - SK[2]) * hl;
          if (force >= 0) { bK = 0.85; kR = LC[0]; kG = LC[1]; kB = LC[2]; }
          B += (bK - B) * ws; A += (1 - A) * ws;
          cR += (kR - cR) * ws; cG += (kG - cG) * ws; cB += (kB - cB) * ws;
        }

        if (inEye) {
          // catchlights: pure white, on top of iris and pupil
          var cu = (x - wX + (y - wY) * 0.12) / wHX, cv = (y - wY) / wHY, hit = false;
          if (cu > -1 && cu < 1 && cv > -1 && cv < 1) {
            hit = (cu > paneX || cu < -paneX) && (cv > paneY || cv < -paneY);
          } else {
            var ddx = x - dotX, ddy = y - dotY;
            hit = ddx * ddx + ddy * ddy < dotR;
          }
          if (hit) { B = 1; A = 1; cR = cG = cB = 255; }
          if (closedK > 0) {                                                 // a nearly closed eye is one clean lash line
            B += (0.86 - B) * closedK;
            cR += (LN[0] - cR) * closedK; cG += (LN[1] - cG) * closedK; cB += (LN[2] - cB) * closedK;
          }
        }

        if (B < 0) B = 0; else if (B > 1) B = 1;
        if (bgK < 1 && force < 0) {                                          // past the hero: it sinks back into the ground
          B = bgB[i] + (B - bgB[i]) * bgK; A = baseA + (A - baseA) * bgK;
          cR = BGC[0] + (cR - BGC[0]) * bgK; cG = BGC[1] + (cG - BGC[1]) * bgK; cB = BGC[2] + (cB - BGC[2]) * bgK;
        }
        var af = A * (0.3 + 0.7 * B) * scan;
        if (force >= 0) af *= bgK;
        if (tN) {                                                            // behind the words it steps back
          var px = (c + 0.5) * cellW, py = (r + 0.5) * cellH, td = tm, t4, tdx, tdy;
          for (k = 0; k < tN; k++) {
            t4 = k * 4;
            tdx = px < tr[t4] ? tr[t4] - px : px > tr[t4 + 2] ? px - tr[t4 + 2] : 0;
            tdy = py < tr[t4 + 1] ? tr[t4 + 1] - py : py > tr[t4 + 3] ? py - tr[t4 + 3] : 0;
            if (tdy > tdx) tdx = tdy;
            if (tdx < td) td = tdx;
          }
          if (td < tm) { td = 1 - td / tm; af *= 1 - TEXT_DIM * td * td * (3 - 2 * td); }
        }
        var ci = 0;
        if (af >= 0.012) {
          if (force >= 0) {
            ci = force;
          } else {
            if (Math.random() < reroll) jit[i] = (Math.random() - 0.5) * 0.16;
            ci = glyphOf(B + jit[i]);
          }
        }
        outCh[i] = ci;
        outTint[o] = cR * af;
        outTint[o + 1] = cG * af;
        outTint[o + 2] = cB * af;
      }
    }
  }

  /* ====================================================================
   * 5. FIELD: one frame
   * ==================================================================== */

  // where everything is on screen right now, and how each thing has moved on
  function update(dt, now) {
    var sx = CW / W, sy = CH / H, r, d1, d2, tx, ty, k, ge, f;

    /* ---- pointer ---- */
    var want = ptr.on ? (now - ptr.moved > 900 ? 0.45 : 1) : 0;  // it dims when the pointer rests
    if (reduce) want = 0;
    ptr.want = want;
    ptr.k += (want - ptr.k) * (1 - Math.exp(-dt * (want > ptr.k ? 14 : 3.5)));
    if (Math.abs(want - ptr.k) < 0.004) ptr.k = want;
    ptrK = ptr.k;
    ptrX = ptr.x * sx;
    ptrY = ptr.y * sy;
    ptrInvR2 = 1 / (PTR_R * dpr * PTR_R * dpr);

    /* ---- star ---- */
    if (star.el) {
      r = star.el.getBoundingClientRect();
      var unit = Math.min(viewW * 0.40, viewH * 0.95);                       // the loader's own measure of the screen
      var zoom = clamp(0.49 * viewH / (0.36 * unit), 1, 1.9);
      star.R = 0.36 * unit * zoom * sx;
      var reach = star.R * (1 + STAR_GROW) * 1.3 + cellH;
      if (star.hold) {
        star.heat = 1;
      } else if (star.cooling) {
        if (star.t0 < 0) star.t0 = now;
        k = (now - star.t0) / (COOL * 1000);
        star.heat = 1 - ease(k);
        if (k >= 1) { star.cooling = false; star.heat = 0; }
      }

      // Hot, it is where the loader left it: the middle of the screen the page
      // opened on. Cooling, it settles onto the block of words (the name, the
      // paragraph, the button), which on a desktop is the same place and on a
      // phone, where the hero is not a full screen tall, is not.
      star.x = (r.left + r.width / 2) * sx;
      star.y = (r.top + viewH / 2) * sy;
      star.tOn = false;
      star.show = 1;
      if (r.width > 0 && r.bottom * sy + reach > 0 && r.top * sy - reach < CH) {
        for (k = 0; k < star.parts.length; k++) {
          d1 = star.parts[k].getBoundingClientRect();
          if (!d1.width) continue;
          if (!star.tOn) {
            star.tOn = true;
            star.tx0 = d1.left; star.tx1 = d1.right; star.ty0 = d1.top; star.ty1 = d1.bottom;
          } else {
            if (d1.left < star.tx0) star.tx0 = d1.left;
            if (d1.right > star.tx1) star.tx1 = d1.right;
            if (d1.top < star.ty0) star.ty0 = d1.top;
            if (d1.bottom > star.ty1) star.ty1 = d1.bottom;
          }
        }
        if (star.tOn) {
          star.tx0 *= sx; star.tx1 *= sx; star.ty0 *= sy; star.ty1 *= sy;
          star.y = lerp((star.ty0 + star.ty1) / 2, star.y, star.heat);
          // The cooled star steps back from the words, so on a small screen,
          // where the words cover nearly all of it, only stray ticks would be
          // left. It is shown in proportion to how much of an arm clears them.
          d2 = star.R * (1 + STAR_GROW);
          k = d2 - (star.ty1 - star.ty0) / 2;
          star.show = clamp01((k - 0.22 * d2) / (0.3 * d2));
        }
      }
      // with the eye behind the name, the star does not stay: as it cools it closes back into the eye
      if (eye.hero) star.show *= 1 - sstep(0.2, 0.75, 1 - star.heat);
      star.vis = r.width > 0 && star.y + reach > 0 && star.y - reach < CH && (star.heat > 0 || star.show > 0);
    }

    /* ---- eye ---- */
    eye.vis = false;
    // in the hero it wakes as the star cools: hidden under the loader, opening as the star goes
    eye.wake = !eye.hero ? 1 : covered ? 0 : sstep(0.3, 0.95, 1 - star.heat);
    if (eye.el && (eye.near || eye.hero) && eye.wake > 0) {
      r = eye.el.getBoundingClientRect();
      // The hero's eye stays for the whole page, as the ground's own: it starts
      // behind the name and, as the name scrolls away, stays where it was
      // (like position:sticky), stepping back so the sections read over it.
      var cyNat = r.top + r.height / 2, cyPin = cyNat, scrolled = 0;
      if (eye.hero) {
        cyPin = Math.max(cyNat, Math.min(cyNat + (window.pageYOffset || 0), H / 2));
        if (star.el) scrolled = clamp01(-star.el.getBoundingClientRect().top / Math.max(1, H * 0.7));
      }
      eye.bgK = 1 - (1 - SCROLL_DIM) * sstep(0, 1, scrolled);
      eye.vis = r.width > 40 && (eye.hero || (r.bottom > 0 && r.top < H));
      if (eye.vis) {
        if (!IRIS) buildIris();
        eye.U = r.width / (2 * (0.75 + SKIN_X)) * sx;
        eye.x = (r.left + r.width / 2) * sx;
        eye.y = cyPin * sy;

        // the words in front of it: the eye steps back where the letters are, so they stay readable
        eye.tN = 0;
        for (k = 0; k < eye.text.length; k++) {
          d1 = eye.text[k].getBoundingClientRect();
          if (!d1.width) continue;
          eye.tr[eye.tN * 4] = d1.left * sx; eye.tr[eye.tN * 4 + 1] = d1.top * sy;
          eye.tr[eye.tN * 4 + 2] = d1.right * sx; eye.tr[eye.tN * 4 + 3] = d1.bottom * sy;
          eye.tN++;
        }

        tx = 0; ty = 0;
        if (reduce) {
          tx = eye.gx; ty = eye.gy;
        } else if (ptr.seen && ptr.on && now - ptr.moved < 5000) {           // it follows the pointer
          tx = clamp((ptrX - eye.x) / eye.U * 0.34, -0.42, 0.42);
          ty = clamp((ptrY - eye.y) / eye.U * 0.2, -0.16, 0.07);
        } else {                                                             // or looks around on the loader's own path
          eye.idle = (eye.idle + dt / 5.4) % 1;
          for (k = 3; k < GAZE.length; k += 3) {
            if (eye.idle <= GAZE[k]) {
              ge = ease((eye.idle - GAZE[k - 3]) / (GAZE[k] - GAZE[k - 3]));
              tx = lerp(GAZE[k - 2], GAZE[k + 1], ge);
              ty = lerp(GAZE[k - 1], GAZE[k + 2], ge);
              break;
            }
          }
        }
        f = 1 - Math.exp(-dt * 9);
        eye.gx += (tx - eye.gx) * f;
        eye.gy += (ty - eye.gy) * f;
        eye.hover += (eye.hoverTo - eye.hover) * (1 - Math.exp(-dt * 7));

        if (!reduce) {                                                       // the loader's blink: 0.24 s on a sine
          if (eye.blinkT < 0 && now > eye.blinkAt) eye.blinkT = 0;
          if (eye.blinkT >= 0) {
            eye.blinkT += dt / 0.24;
            if (eye.blinkT >= 1) {
              eye.blinkT = -1;
              eye.open = 1;
              eye.blinkAt = now + 2400 + Math.random() * 4200;
            } else {
              eye.open = Math.max(0.04, 1 - Math.sin(Math.PI * eye.blinkT));
            }
          }
        }
      }
    }
  }

  function compose(dt) {
    var n = cols * rows, k, i, count;

    // the clouds flicker in place, slowly
    count = Math.min(n, Math.round(n * (1 - Math.exp(-CLOUD_RATE * dt))));
    for (k = 0; k < count; k++) {
      i = (Math.random() * n) | 0;
      jit[i] = (Math.random() - 0.5) * 0.16;
      baseCh[i] = glyphOf(bgB[i] + jit[i]);
    }
    setGain(gainWanted());
    outCh.set(baseCh);
    outTint.set(baseTint);

    if (ptrK > 0.004) layerPointer(dt);
    if (star.vis) layerStar(clock, dt);
    if (eye.vis) layerEye(clock, dt);
  }

  function step(now, force) {
    if (!fieldOn) return;
    if (needResize) { needResize = false; if (resize(false)) dirty = true; }

    // full rate only while something is actually changing: a scroll, a moving pointer, its light settling
    var moving = dirty || (ptr.on && now - ptr.moved < 950) || ptr.k !== ptr.want;
    var lively = star.cooling || eye.vis;
    var gap = moving ? 0 : lively ? 30 : covered ? 260 : 100;    // idle: ten frames a second is plenty for a slow flicker
    if (!force && now - lastDraw < gap) return;

    var dt = lastDraw ? Math.min(0.25, Math.max(0, (now - lastDraw) / 1000)) : 0;
    if (reduce) dt = 0;
    lastDraw = now;
    clock += dt;
    dirty = false;
    update(dt, now);
    compose(dt);
    draw();
  }

  function loop(now) {
    rafId = window.requestAnimationFrame(loop);
    step(now, false);
  }

  // reduced motion: no loop, one still frame whenever the page moves
  var stillQueued = false;
  function still() {
    if (stillQueued || !fieldOn) return;
    stillQueued = true;
    window.requestAnimationFrame(function (now) { stillQueued = false; step(now, true); });
  }

  function touchField() {
    dirty = true;
    if (reduce) still();
  }

  function startField() {
    canvas = document.createElement('canvas');
    canvas.className = 'glyphs';
    canvas.setAttribute('aria-hidden', 'true');
    if (!document.body) return;
    document.body.insertBefore(canvas, document.body.firstChild);
    if (!initGL()) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      return;
    }
    buildTables();
    try {
      resize(true);
    } catch (e) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = gl = glS = null;
      return;
    }
    needResize = false;
    fieldOn = true;
    html.classList.add('field-on');

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      fieldOn = false;
      html.classList.remove('field-on');
    });
    canvas.addEventListener('webglcontextrestored', function () {
      if (!initGL()) return;
      try { resize(true); } catch (e) { return; }
      fieldOn = true;
      html.classList.add('field-on');
      touchField();
    });

    window.addEventListener('resize', function () { needResize = true; touchField(); });
    window.addEventListener('scroll', touchField, { passive: true });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      ptr.seen = true; ptr.on = 1; ptr.moved = window.performance.now();
    }, { passive: true });
    html.addEventListener('mouseleave', function () { ptr.on = 0; });
    window.addEventListener('blur', function () { ptr.on = 0; });

    if (reduce) still(); else rafId = window.requestAnimationFrame(loop);
  }

  /* ====================================================================
   * 6. DISSOLVE: the loader's way out, used as the page's way in
   * ==================================================================== */

  // The loader's order: every block waits for its distance to the nearest seed, plus 15% noise.
  function spread(bc, br, seeds) {
    var n = bc * br, d = new Float32Array(n), i, k, x, y, ex, ey, dd, best, far = 0;
    for (i = 0; i < n; i++) {
      x = i % bc; y = (i / bc) | 0; best = 1e9;
      for (k = 0; k < seeds.length; k += 2) {
        ex = seeds[k] - x; ey = seeds[k + 1] - y;
        dd = ex * ex + ey * ey;
        if (dd < best) best = dd;
      }
      d[i] = Math.sqrt(best);
      if (d[i] > far) far = d[i];
    }
    for (i = 0; i < n; i++) d[i] = (far ? d[i] / far : 0) * 0.85 + Math.random() * 0.15;
    return d;
  }

  function seedsFor(bc, br) {
    var s = [], k, n = 2 + Math.min(10, Math.round(bc * br / 700));
    for (k = 0; k < n; k++) s.push(Math.random() * bc, Math.random() * br);
    return s;
  }

  // Paint the ground as it is on screen right now into a cover: the field's own
  // pixels for the part of the page the cover sits over. The field is one screen
  // tall, so what lies below the fold takes the field wrapped around: the same
  // texture, which is all that is needed of it for the second it is there.
  var snapAt = -1;
  function paintGround(g, rect, sc, pw, ph) {
    g.fillStyle = INK_CSS;
    g.fillRect(0, 0, pw, ph);
    var now = window.performance.now(), x0, y0, y = 0, sy0, hh;
    try {
      if (now - snapAt > 4) { step(now, true); snapAt = now; }   // a WebGL canvas can only be copied in the task that drew it
      x0 = Math.round(rect.left * sc);
      y0 = Math.round(rect.top * sc);
      while (y < ph) {
        sy0 = (((y0 + y) % CH) + CH) % CH;
        hh = Math.min(ph - y, CH - sy0);
        g.drawImage(canvas, x0, sy0, pw, hh, 0, y, pw, hh);
        y += hh;
      }
    } catch (e) {}
  }

  // An element scrolling into view: it is already there, under a cover that
  // looks exactly like the ground it stands on, and the cover falls away in
  // blocks. So nothing is seen to be covered; the thing just assembles.
  function reveal(el, wait) {
    // Without the field there is no ground to paint the cover with, and a plain
    // dark one would show as a box. The caller's fade is the better arrival then.
    if (reduce || !el || !fieldOn) return false;
    var rect = el.getBoundingClientRect(), w = rect.width, h = rect.height;
    if (w < 8 || h < 8) return false;
    var sc = CW / W;
    if (w * h * sc * sc > 5e6) sc = Math.sqrt(5e6 / (w * h));    // a very large element gets a coarser cover, not a larger one
    var pw = Math.max(1, Math.round(w * sc)), ph = Math.max(1, Math.round(h * sc));
    var bs = Math.max(2, Math.round(BLOCK * sc)), bc = Math.ceil(pw / bs), br = Math.ceil(ph / bs), n = bc * br;
    var cv = document.createElement('canvas'), g;
    cv.width = pw;
    cv.height = ph;
    g = cv.getContext('2d');
    if (!g) return false;
    cv.className = 'px-cover';
    cv.setAttribute('aria-hidden', 'true');
    paintGround(g, rect, sc, pw, ph);

    var delay = spread(bc, br, seedsFor(bc, br)), gone = new Uint8Array(n), left = n;
    var t0 = 0, dur = 560 + Math.min(360, n / 9);
    el.classList.add('px-in');
    el.appendChild(cv);

    function run(now) {
      if (!t0) t0 = now + (wait || 0);
      var p = (now - t0) / dur, i;
      if (p > 0) {
        for (i = 0; i < n; i++) {
          if (!gone[i] && delay[i] <= p) { gone[i] = 1; left--; g.clearRect((i % bc) * bs, ((i / bc) | 0) * bs, bs, bs); }
        }
      }
      if (left > 0 && p < 1.1) window.requestAnimationFrame(run);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
    window.requestAnimationFrame(run);

    var price = el.querySelector ? el.querySelector('.tier-price b') : null;
    if (price) decodeNumber(price, (wait || 0) + 120, dur + 260);
    return true;
  }

  // A slideshow changing frame: the old frame is drawn into a canvas on top,
  // the new one takes its place underneath, and the canvas dissolves.
  // Returns true when it has taken the change over (it then moves the "active"
  // class itself, once the new frame is decoded), false when the caller should
  // simply switch the classes and let the CSS crossfade do it.
  function swap(box, from, to) {
    if (!box) return false;
    var w = box.clientWidth, h = box.clientHeight;
    if (reduce || w < 8 || h < 8 || !from || !from.complete || !from.naturalWidth || !to || !to.complete || !to.naturalWidth) {
      box.classList.remove('px');
      return false;
    }
    var d = Math.min(2, window.devicePixelRatio || 1), bs = Math.max(2, Math.round(BLOCK * d));
    var cw = Math.round(w * d), ch = Math.round(h * d);
    var cv = document.createElement('canvas'), g, s, dw, dh;
    cv.width = cw;
    cv.height = ch;
    g = cv.getContext('2d');
    if (!g) { box.classList.remove('px'); return false; }
    try {
      s = Math.max(cw / from.naturalWidth, ch / from.naturalHeight);       // object-fit: cover
      dw = from.naturalWidth * s; dh = from.naturalHeight * s;
      g.drawImage(from, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    } catch (e) {
      box.classList.remove('px');
      return false;
    }
    cv.className = 'px-swap';
    cv.setAttribute('aria-hidden', 'true');

    var bc = Math.ceil(cw / bs), br = Math.ceil(ch / bs), n = bc * br;
    var delay = spread(bc, br, seedsFor(bc, br)), gone = new Uint8Array(n), left = n;
    var t0 = 0, dur = 760, begun = false;

    function run(now) {
      if (!t0) t0 = now;
      var p = (now - t0) / dur, i;
      for (i = 0; i < n; i++) {
        if (!gone[i] && delay[i] <= p) { gone[i] = 1; left--; g.clearRect((i % bc) * bs, ((i / bc) | 0) * bs, bs, bs); }
      }
      if (left > 0 && p < 1.1) window.requestAnimationFrame(run);
      else if (cv.parentNode) cv.parentNode.removeChild(cv);
    }

    function begin() {
      if (begun) return;
      begun = true;
      var old = box.querySelectorAll('.px-swap'), k;
      for (k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);
      box.classList.add('px');                                              // no crossfade underneath
      box.appendChild(cv);
      from.classList.remove('active');
      to.classList.add('active');
      window.requestAnimationFrame(run);
    }

    // The incoming frame has to be decoded before the first hole opens onto it,
    // or the hole shows the empty screen behind for a frame or two.
    if (typeof to.decode === 'function') {
      to.decode().then(begin, begin);
      window.setTimeout(begin, 600);
    } else {
      begin();
    }
    return true;
  }

  /* ====================================================================
   * 7. DECODE: characters first, letters after
   * ==================================================================== */

  var title = null, chars = [], decodeId = 0;

  // The name is split into one span per character. The real letter is always in
  // the markup; while it is still "arriving" it is transparent and a ramp
  // character stands in for it (CSS draws that from data-g). The heading keeps
  // its full text as an aria-label, so nothing is read out letter by letter.
  function prepTitle() {
    var el = document.querySelector('.hero-title');
    if (!el || reduce) return;
    var lines = el.querySelectorAll('.tl i'), full = [], k, j, txt, ch, span;
    if (!lines.length) return;
    chars = [];
    for (k = 0; k < lines.length; k++) {
      txt = lines[k].textContent;
      full.push(txt);
      lines[k].textContent = '';
      for (j = 0; j < txt.length; j++) {
        ch = txt.charAt(j);
        if (/\s/.test(ch)) { lines[k].appendChild(document.createTextNode(ch)); continue; }
        span = document.createElement('span');
        span.className = 'ch w';
        span.textContent = ch;
        lines[k].appendChild(span);
        chars.push({ el: span, line: k, at: 0, len: 0, state: 0, next: 0 });
      }
      lines[k].setAttribute('aria-hidden', 'true');
    }
    el.setAttribute('aria-label', full.join(' '));
    el.classList.add('dec');
    title = el;
  }

  function hideTitle() {
    var k;
    if (!title) return;
    if (decodeId) { window.cancelAnimationFrame(decodeId); decodeId = 0; }
    for (k = 0; k < chars.length; k++) { chars[k].state = 0; chars[k].el.className = 'ch w'; }
  }

  function decodeTitle() {
    if (!title) return;
    var t0 = window.performance.now(), k, c;
    hideTitle();
    for (k = 0; k < chars.length; k++) {
      c = chars[k];
      c.at = (c.line ? 300 : 80) + Math.random() * 460;          // appears in random order, first line first
      c.len = 240 + Math.random() * 420;                         // then flickers this long
      c.next = 0;
    }
    function run(now) {
      var t = now - t0, busy = false, i, q;
      for (i = 0; i < chars.length; i++) {
        q = chars[i];
        if (q.state === 2) continue;
        if (t < q.at) { busy = true; continue; }
        if (t >= q.at + q.len) {
          q.state = 2;
          q.el.className = 'ch';
          q.el.removeAttribute('data-g');
          continue;
        }
        busy = true;
        if (q.state === 0) { q.state = 1; q.el.className = 'ch s'; }
        if (t >= q.next) {
          q.next = t + 55;
          q.el.setAttribute('data-g', RAMP.charAt(20 + ((Math.random() * (RAMP_N - 20)) | 0)));
        }
      }
      decodeId = busy ? window.requestAnimationFrame(run) : 0;
    }
    decodeId = window.requestAnimationFrame(run);
  }

  // A price: its digits run before they settle, left to right.
  function decodeNumber(el, wait, dur) {
    if (reduce || !el || el.getAttribute('data-run')) return;
    var txt = el.textContent, t0 = window.performance.now() + (wait || 0), last = 0;
    el.setAttribute('data-run', '1');
    function run(now) {
      var p = (now - t0) / dur, out = '', k, ch;
      if (p >= 1) { el.textContent = txt; el.removeAttribute('data-run'); return; }
      if (p > 0 && now - last > 48) {
        last = now;
        for (k = 0; k < txt.length; k++) {
          ch = txt.charAt(k);
          out += (ch >= '0' && ch <= '9' && (k + 1) / txt.length > p * 1.25) ? String((Math.random() * 10) | 0) : ch;
        }
        el.textContent = out;
      }
      window.requestAnimationFrame(run);
    }
    window.requestAnimationFrame(run);
  }

  /* ====================================================================
   * 8. BURST: the loader's falling squares, a few at a time
   * ==================================================================== */

  var bcv = null, bg = null, parts = [], burstId = 0, burstLast = 0, bd = 1;

  function burst(x, y, count) {
    if (reduce) return;
    var k, a, v, n = count || 12;
    if (!bcv) {
      bcv = document.createElement('canvas');
      bg = bcv.getContext('2d');
      if (!bg) { bcv = null; return; }
      bcv.className = 'px-burst';
      bcv.setAttribute('aria-hidden', 'true');
      (document.body || html).appendChild(bcv);
    }
    bd = Math.min(2, window.devicePixelRatio || 1);
    // the canvas is laid out against the viewport without its scrollbar, so it is measured the same way
    var w = Math.round((html.clientWidth || window.innerWidth) * bd), h = Math.round((html.clientHeight || window.innerHeight) * bd);
    if (bcv.width !== w || bcv.height !== h) { bcv.width = w; bcv.height = h; }
    bcv.style.display = 'block';
    for (k = 0; k < n; k++) {
      a = Math.random() * 6.2832;
      v = (50 + Math.random() * 230) * 0.85;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90,
        s: 2 + Math.random() * 2.5, white: Math.random() < 0.6,
        age: 0, life: 0.5 + Math.random() * 0.45
      });
    }
    if (!burstId) { burstLast = 0; burstId = window.requestAnimationFrame(burstRun); }
  }

  // gravity 900 px/s2, fading out over their lifetime: the loader's numbers
  function burstRun(now) {
    var dt = burstLast ? Math.min(0.05, Math.max(0, (now - burstLast) / 1000)) : 0, keep = 0, i, p, alpha, s;
    burstLast = now;
    bg.clearRect(0, 0, bcv.width, bcv.height);
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      parts[keep++] = p;
      alpha = 1 - p.age / p.life;
      s = Math.max(1, Math.round(p.s * bd));
      bg.fillStyle = p.white ? '#fff' : AC_CSS;
      bg.globalAlpha = alpha * 0.2;                              // a little glow, as a larger square
      bg.fillRect(Math.round(p.x * bd - s * 1.5), Math.round(p.y * bd - s * 1.5), s * 3, s * 3);
      bg.globalAlpha = alpha;
      bg.fillRect(Math.round(p.x * bd - s / 2), Math.round(p.y * bd - s / 2), s, s);
    }
    parts.length = keep;
    bg.globalAlpha = 1;
    if (keep) {
      burstId = window.requestAnimationFrame(burstRun);
    } else {
      burstId = 0;
      bg.clearRect(0, 0, bcv.width, bcv.height);
      bcv.style.display = 'none';
    }
  }

  /* ====================================================================
   * 9. BOOT
   * ==================================================================== */

  var started = false, waiting = [];

  // html.eye-loading without html.eye-loaded = the loader is still covering the page
  function readState() {
    var was = covered;
    covered = html.classList.contains('eye-loading') && !html.classList.contains('eye-loaded');
    if (covered && !was) {
      if (!reduce) { star.hold = true; star.cooling = false; star.heat = 1; }
      hideTitle();
    } else if (!covered && was) {
      arrive();
    }
  }

  // the page is on show (the dissolve is under way, or there was no loader)
  function arrive() {
    var list = waiting, k;
    waiting = [];
    if (star.hold) { star.hold = false; star.cooling = true; star.t0 = -1; }
    decodeTitle();
    touchField();
    for (k = 0; k < list.length; k++) { try { list[k](); } catch (e) {} }
  }

  // run fn once the page is on show: now, or when the loader starts to uncover it
  function ready(fn) {
    if (typeof fn !== 'function') return;
    if (started && !covered) fn(); else waiting.push(fn);
  }

  function init() {
    if (started) return;
    started = true;

    star.el = document.querySelector('.hero');
    star.parts = Array.prototype.slice.call(document.querySelectorAll('.hero-title, .hero-desc, .hero-cta'));
    eye.el = document.getElementById('eye-stage');
    eye.hero = !!(eye.el && eye.el.closest && eye.el.closest('.hero'));
    eye.text = eye.hero ? Array.prototype.slice.call(document.querySelectorAll('.hero-title, .hero-desc, .hero-cta')) : [];

    var rampEl = document.getElementById('ramp');
    if (rampEl) rampEl.textContent = RAMP.slice(1);              // the alphabet the eye is drawn in, dark to bright

    prepTitle();
    try { startField(); } catch (e) { fieldOn = false; }

    // the eye: only measured while it is near the screen; the replay button plays the intro again
    var btn = document.getElementById('eye-btn');
    if (eye.el) {
      eye.blinkAt = window.performance.now() + 1800;
      if ('IntersectionObserver' in window) {
        new window.IntersectionObserver(function (entries) {
          eye.near = entries[entries.length - 1].isIntersecting;
          touchField();
        }, { rootMargin: '200px 0px 200px 0px' }).observe(eye.el);
      } else {
        eye.near = true;
      }
    }
    if (btn) {
      if (reduce || !window.EyeLoader) {                         // nothing to replay: the button stays hidden
        btn.classList.add('is-still');
      } else {
        btn.hidden = false;                                      // now there is an intro it can replay
        btn.removeAttribute('tabindex');
        btn.removeAttribute('aria-hidden');
        btn.classList.add('is-live');
        btn.addEventListener('pointerenter', function () { eye.hoverTo = 1; });
        btn.addEventListener('pointerleave', function () { eye.hoverTo = 0; });
        btn.addEventListener('focus', function () { eye.hoverTo = 1; });
        btn.addEventListener('blur', function () { eye.hoverTo = 0; });
        btn.addEventListener('click', function () {
          if (covered) return;
          eye.blinkT = 0;                                        // it blinks, then the intro runs from the top of the page
          window.setTimeout(function () {
            window.EyeLoader.replay();
            window.setTimeout(function () {
              try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
            }, 80);
          }, 240);
        });
      }
    }

    // a pressed button sheds a few squares
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.btn,.link-btn,.tier-cta,.form-submit') : null;
      if (!t) return;
      var x = e.clientX, y = e.clientY, r;
      if (!x && !y) { r = t.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
      burst(x, y, 12);
    });

    // follow the loader through its classes on <html>
    covered = false;
    if (window.MutationObserver) {
      new window.MutationObserver(readState).observe(html, { attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('eyeloader:done', readState);     // and once more when it has gone, in case a class was missed
    readState();
    if (!covered) arrive();
  }

  window.EyeTheme = { init: init, ready: ready, reveal: reveal, swap: swap, burst: burst };
})(window, document);
