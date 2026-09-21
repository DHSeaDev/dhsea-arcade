/* MOSSLIGHT — procedural art. art(record) -> SVG string. Deterministic: same id, same bytes.
   LOOK
     subject:  small woodland / volcanic / frost creatures, nervous chibi raiders, a lantern-bearing healer
     job:      read as a creature with a face at 40px in a card and ~90px on the lane
     use-size: 28px (icons) .. 140px (lane captains)
     idiom:    flat illustration, cel-banded: three value bands per mass, no gradients in sprites, no filters
     palette:  five tones per hue — shadow, base, light, highlight, outline; shadows rotate toward blue, lights toward yellow
     light:    top-left, hard
     line:     uniform outline in a dark tint of the local hue, round joins
     ground:   both (dark UI panels and the painted lane)
*/
(function (ML) {
  'use strict';
  var A = ML.Art = {};
  function f(n) { return Math.round(n * 10) / 10; }
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100; var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } function hx(v) { v = Math.round((v + m) * 255).toString(16); return v.length < 2 ? '0' + v : v; } return '#' + hx(r) + hx(g) + hx(b); }
  function toward(h, target, amt) { var d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); }
  // five tones: [shadow, base, light, highlight, outline]
  A.pal = function (h, s, l) { l = l == null ? 50 : l; return [hsl(toward(h, 240, 22), s * 0.9, l - 17), hsl(h, s, l), hsl(toward(h, 55, 10), s * 0.95, l + 13), hsl(toward(h, 55, 18), s * 0.7, Math.min(94, l + 30)), hsl(toward(h, 250, 30), Math.min(60, s * 0.8 + 8), Math.max(9, l - 36))]; };
  A.hsl = hsl;
  var SW = 2.4, SKIN = ['#d9a282', '#f2c9a6', '#fadcc0', '#fff0de', '#5a3426'];
  function el(tag, attrs, inner) { var s = '<' + tag; Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) s += ' ' + k + '="' + (typeof attrs[k] === 'number' ? f(attrs[k]) : attrs[k]) + '"'; }); return s + (inner == null ? '/>' : '>' + inner + '</' + tag + '>'); }
  function rot(a, cx, cy) { return a ? 'rotate(' + f(a) + ' ' + f(cx) + ' ' + f(cy) + ')' : null; }
  // cel-banded ellipse: shadow silhouette, base band shifted to the light, light band smaller again. Inner bands stay inside the silhouette by construction.
  function ball(cx, cy, rx, ry, p, a, o) {
    o = o || {}; var t = rot(a, cx, cy), g = '';
    g += el('ellipse', { cx: cx, cy: cy, rx: rx, ry: ry, fill: p[0], stroke: p[4], 'stroke-width': o.sw == null ? SW : o.sw, transform: t });
    g += el('ellipse', { cx: cx - rx * 0.09, cy: cy - ry * 0.1, rx: rx * 0.85, ry: ry * 0.84, fill: p[1], transform: t });
    if (!o.flat) g += el('ellipse', { cx: cx - rx * 0.26, cy: cy - ry * 0.3, rx: rx * 0.5, ry: ry * 0.46, fill: p[2], transform: t });
    if (o.gloss) g += el('ellipse', { cx: cx - rx * 0.42, cy: cy - ry * 0.5, rx: rx * 0.16, ry: ry * 0.11, fill: p[3], transform: rot((a || 0) - 28, cx - rx * 0.42, cy - ry * 0.5) });
    return g;
  }
  function limb(x1, y1, x2, y2, w, p) { return el('path', { d: 'M' + f(x1) + ' ' + f(y1) + 'L' + f(x2) + ' ' + f(y2), stroke: p[4], 'stroke-width': w + SW * 1.6, 'stroke-linecap': 'round', fill: 'none' }) + el('path', { d: 'M' + f(x1) + ' ' + f(y1) + 'L' + f(x2) + ' ' + f(y2), stroke: p[0], 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none' }) + el('path', { d: 'M' + f(x1 - w * 0.12) + ' ' + f(y1 - w * 0.1) + 'L' + f(x2 - w * 0.12) + ' ' + f(y2 - w * 0.1), stroke: p[1], 'stroke-width': w * 0.62, 'stroke-linecap': 'round', fill: 'none' }); }
  function shape(d, fill, p, o) { o = o || {}; return el('path', { d: d, fill: fill, stroke: o.noline ? null : p[4], 'stroke-width': o.noline ? null : (o.sw || SW), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: o.op }); }
  function eye(cx, cy, r, p, mood) {
    var g = el('circle', { cx: cx, cy: cy, r: r, fill: '#fdfbf3', stroke: p[4], 'stroke-width': 1.6 }) + el('circle', { cx: cx + r * 0.22, cy: cy + r * 0.08, r: r * 0.56, fill: '#1d1a2b' }) + el('circle', { cx: cx - r * 0.12, cy: cy - r * 0.3, r: r * 0.24, fill: '#ffffff' });
    if (mood === 'worry') g += el('path', { d: 'M' + f(cx - r * 1.2) + ' ' + f(cy - r * 1.7) + 'L' + f(cx + r * 0.9) + ' ' + f(cy - r * 1.15), stroke: p[4], 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' });
    return g;
  }
  function eyesR(cx, cy, r, gap, p, mood) { return eye(cx, cy, r, p, mood) + eye(cx + gap, cy + 0.5, r * 0.92, p, mood); }
  function smile(cx, cy, w, p, open) { return open ? el('path', { d: 'M' + f(cx - w) + ' ' + f(cy) + 'Q' + f(cx) + ' ' + f(cy + w * 1.5) + ' ' + f(cx + w) + ' ' + f(cy) + 'Z', fill: '#7a2c3a', stroke: p[4], 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) : el('path', { d: 'M' + f(cx - w) + ' ' + f(cy) + 'Q' + f(cx) + ' ' + f(cy + w) + ' ' + f(cx + w) + ' ' + f(cy), fill: 'none', stroke: p[4], 'stroke-width': 1.8, 'stroke-linecap': 'round' }); }
  function ground(cx, rx, y) { return el('ellipse', { cx: cx, cy: y == null ? 92 : y, rx: rx, ry: rx * 0.17, fill: '#0b1020', opacity: 0.28 }); }
  function svg(body, title, vb) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (vb || '0 0 100 100') + '" role="img"><title>' + title + '</title>' + body + '</svg>'; }

  /* ---------- species look table (hue, sat, light, accent hue) ---------- */
  var LOOK = {
    mossling: [96, 46, 46, 320], pebblit: [30, 17, 52, 48], thistlehog: [26, 38, 45, 292], glowmoth: [46, 78, 58, 28],
    emberpup: [14, 78, 52, 44], slagback: [6, 26, 30, 30], sootwisp: [268, 18, 34, 300], cindermole: [24, 34, 40, 48],
    frostfinch: [202, 62, 58, 38], glimmereel: [182, 52, 50, 320], prismstag: [262, 24, 72, 0], dewsprite: [148, 52, 56, 200]
  };
  var FORMS = {
    blob: function (p, q, r) {
      var g = ground(50, 30), n = 3 + Math.floor(r() * 3), i;
      g += ball(32, 86, 9, 5, p, 0, { flat: 1 }) + ball(68, 86, 9, 5, p, 0, { flat: 1 });
      g += shape('M18 74C16 46 32 30 50 30C68 30 84 46 82 74C82 86 70 90 50 90C30 90 18 86 18 74Z', p[0], p);
      g += shape('M22 71C21 48 35 35 49 35C63 35 75 46 75 66C75 78 66 84 48 84C31 84 22 80 22 71Z', p[1], p, { noline: 1 });
      g += shape('M27 60C27 47 37 40 46 40C54 40 59 45 58 52C52 50 44 52 38 58C34 62 28 66 27 60Z', p[2], p, { noline: 1 });
      for (i = 0; i < n; i++) { var x = 34 + i * (32 / Math.max(1, n - 1)) + (r() - 0.5) * 4, h = 9 + r() * 7, a = (r() - 0.5) * 30; g += shape('M' + f(x - 3.5) + ' 34Q' + f(x + a * 0.1) + ' ' + f(34 - h) + ' ' + f(x + 3.5) + ' 34Z', q[1], q, { sw: 1.8 }); }
      g += el('path', { d: 'M50 31C50 22 53 17 58 14', stroke: q[4], 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }) + ball(60, 13, 5.2, 4.6, q, -20, { sw: 1.8, gloss: 1 });
      return g + eyesR(42, 60, 6.4, 18, p) + smile(51, 72, 5, p) + el('ellipse', { cx: 33, cy: 69, rx: 4, ry: 2.4, fill: q[2], opacity: 0.5 }) + el('ellipse', { cx: 69, cy: 69, rx: 4, ry: 2.4, fill: q[2], opacity: 0.5 });
    },
    crab: function (p, q, r) {
      var g = ground(50, 34), i;
      for (i = 0; i < 3; i++) { g += limb(30 - i * 3, 74 + i * 2, 18 - i * 2, 88, 4.5, p) + limb(70 + i * 3, 74 + i * 2, 82 + i * 2, 88, 4.5, p); }
      g += shape('M20 72L24 52L38 40L60 38L76 50L80 72L66 82L34 82Z', p[0], p);
      g += shape('M25 69L28 54L40 45L58 43L70 52L73 66L62 76L36 76Z', p[1], p, { noline: 1 });
      g += shape('M30 60L32 53L42 47L54 46L50 52L40 55Z', p[2], p, { noline: 1 });
      var specks = 3 + Math.floor(r() * 4); for (i = 0; i < specks; i++) g += el('circle', { cx: 34 + r() * 34, cy: 56 + r() * 18, r: 1.2 + r() * 1.6, fill: p[0], opacity: 0.8 });
      g += limb(78, 62, 90, 50, 5, p) + ball(91, 45, 7, 6, p, 20, { flat: 1 }) + ball(92, 40, 4, 3.4, q, 0, { sw: 1.6, gloss: 1 });
      g += limb(22, 62, 12, 54, 5, p) + ball(10, 50, 6.4, 5.4, p, -20, { flat: 1 });
      g += el('path', { d: 'M44 42L42 30M58 41L60 29', stroke: p[4], 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' });
      return g + eye(42, 28, 5.4, p) + eye(60, 27, 5.4, p) + smile(51, 66, 4.5, p);
    },
    beast: function (p, q, r, o) {
      o = o || {}; var g = ground(50, 34), i, n;
      g += limb(30, 70, 28, 88, 7, p) + limb(60, 70, 62, 88, 7, p);
      if (o.tail === 'flame') { g += shape('M22 62C8 58 8 40 18 30C17 40 24 42 22 50C28 46 28 38 27 34C36 44 34 58 26 66Z', q[1], q) + shape('M21 58C15 54 15 46 19 41C20 47 24 49 23 55Z', q[3], q, { noline: 1 }); }
      else g += ball(20, 62, 7, 5, p, -30, { flat: 1 });
      g += ball(44, 62, 27, 19, p, -4);
      if (o.spikes) { n = 5 + Math.floor(r() * 3); for (i = 0; i < n; i++) { var x = 24 + i * (40 / (n - 1)), h = 14 + r() * 8, y = 47 - Math.sin(i / (n - 1) * Math.PI) * 6; g += shape('M' + f(x - 5) + ' ' + f(y + 3) + 'L' + f(x - 3 + (r() - 0.5) * 4) + ' ' + f(y - h) + 'L' + f(x + 5) + ' ' + f(y + 3) + 'Z', q[1], q, { sw: 1.8 }); } }
      g += limb(40, 72, 38, 89, 7.5, p) + limb(68, 72, 70, 89, 7.5, p);
      g += ball(72, 50, 17, 15.5, p, 0, { gloss: 1 });
      if (o.ear === 'point') g += shape('M60 40L58 22L70 36Z', p[1], p) + shape('M78 36L88 22L86 42Z', p[1], p) + shape('M62 36L61 28L67 35Z', q[2], q, { noline: 1 });
      else g += ball(62, 36, 5.5, 5, p, 0, { flat: 1 }) + ball(84, 37, 5.5, 5, p, 0, { flat: 1 });
      g += ball(87, 55, 5, 4, p, 0, { flat: 1 }) + el('ellipse', { cx: 90, cy: 53.5, rx: 2.4, ry: 1.9, fill: p[4] });
      return g + eyesR(68, 47, 5, 13, p) + smile(80, 60, 3.4, p, o.tail === 'flame');
    },
    flyer: function (p, q, r, o) {
      o = o || {}; var g = ground(50, 20, 93), i;
      if (o.moth) {
        g += shape('M46 46C30 18 6 20 8 42C9 54 26 58 44 54Z', q[1], q) + shape('M44 56C26 58 16 66 22 78C30 86 42 72 47 60Z', q[0], q);
        g += shape('M56 46C70 18 94 20 92 42C91 54 74 58 58 54Z', q[1], q) + shape('M58 56C74 58 84 66 78 78C70 86 60 72 55 60Z', q[0], q);
        g += el('circle', { cx: 24, cy: 38, r: 6, fill: q[3] }) + el('circle', { cx: 76, cy: 38, r: 6, fill: q[3] }) + el('circle', { cx: 24, cy: 38, r: 2.6, fill: q[4] }) + el('circle', { cx: 76, cy: 38, r: 2.6, fill: q[4] });
        var dots = 2 + Math.floor(r() * 3); for (i = 0; i < dots; i++) { var dx = 14 + r() * 20, dy = 28 + r() * 20; g += el('circle', { cx: dx, cy: dy, r: 1.6, fill: q[3], opacity: 0.8 }) + el('circle', { cx: 100 - dx, cy: dy, r: 1.6, fill: q[3], opacity: 0.8 }); }
        g += el('path', { d: 'M46 34C42 24 38 20 34 18M54 34C58 24 62 20 66 18', stroke: p[4], 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' });
        g += ball(50, 56, 9, 16, p, 0) + ball(50, 42, 10.5, 10, p, 0, { gloss: 1 });
        return g + eyesR(45, 41, 4, 10, p) + smile(50, 48, 2.6, p) + el('ellipse', { cx: 50, cy: 70, rx: 6, ry: 4, fill: q[3], opacity: 0.9 });
      }
      g += shape('M40 52C24 34 8 36 6 50C18 50 22 58 38 60Z', p[0], p) + shape('M22 44L10 40M26 50L12 50', p[0], p);
      g += shape('M30 62L10 72L14 62L6 60L28 56Z', q[1], q);
      g += ball(50, 56, 22, 17, p, -8) + ball(70, 44, 13.5, 12.5, p, 0, { gloss: 1 });
      g += shape('M58 50C46 40 36 46 34 58C44 56 52 60 60 58Z', p[2], p) + shape('M81 44L94 47L81 51Z', q[1], q);
      g += shape('M66 31L70 20L74 31Z', q[1], q, { sw: 1.8 }) + shape('M60 34L61 24L67 32Z', q[1], q, { sw: 1.8 });
      g += el('path', { d: 'M48 72L46 82M58 72L60 82', stroke: q[4], 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' });
      return g + eyesR(68, 42, 4.2, 9, p);
    },
    tortoise: function (p, q, r) {
      var g = ground(50, 38), i;
      g += limb(26, 74, 24, 88, 9, p) + limb(66, 74, 68, 88, 9, p) + ball(12, 72, 6, 4, p, 20, { flat: 1 });
      g += shape('M12 72C12 40 30 24 50 24C70 24 82 40 82 72Z', p[0], p) + shape('M17 69C18 44 33 30 49 30C64 30 74 42 75 64C60 70 34 72 17 69Z', p[1], p, { noline: 1 }) + shape('M24 56C26 42 36 35 46 35C52 35 54 40 50 44C40 46 32 52 28 60Z', p[2], p, { noline: 1 });
      var cr = 4 + Math.floor(r() * 3); for (i = 0; i < cr; i++) { var x = 22 + i * (52 / cr) + r() * 4, y = 40 + r() * 10; g += el('path', { d: 'M' + f(x) + ' ' + f(y) + 'l' + f(3 + r() * 4) + ' ' + f(8 + r() * 5) + 'l' + f(-4 - r() * 3) + ' ' + f(7 + r() * 4), stroke: q[2], 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) + el('path', { d: 'M' + f(x) + ' ' + f(y) + 'l' + f(3) + ' ' + f(8), stroke: q[3], 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }); }
      g += shape('M10 72L84 72L80 79L14 79Z', p[0], p);
      g += limb(36, 78, 35, 89, 9, p) + limb(74, 78, 76, 89, 9, p);
      g += ball(86, 60, 12, 11, p, 0, { gloss: 1 });
      return g + eyesR(83, 57, 4, 8.5, p, 'worry') + smile(89, 66, 3, p);
    },
    wisp: function (p, q, r, o) {
      o = o || {}; var g = ground(50, 18, 94), i;
      g += shape('M50 12C56 26 78 36 76 60C75 76 64 86 50 86C36 86 25 76 24 60C23 44 40 34 44 24C46 20 48 16 50 12Z', p[0], p);
      g += shape('M49 22C53 32 70 42 69 58C68 72 60 80 49 80C38 80 30 72 29 60C28 46 42 40 46 30Z', p[1], p, { noline: 1 });
      g += shape('M46 36C44 44 34 48 34 60C34 66 38 70 42 70C40 60 46 52 50 46C52 42 49 38 46 36Z', p[2], p, { noline: 1 });
      if (o.drop) { g += shape('M50 4C54 10 58 14 58 19C58 24 54 27 50 27C46 27 42 24 42 19C42 14 46 10 50 4Z', q[1], q, { sw: 1.8 }) + el('ellipse', { cx: 47, cy: 17, rx: 1.8, ry: 3, fill: q[3] }) + shape('M70 30C78 24 88 26 90 34C82 38 74 38 70 30Z', ML.Art.pal(120, 50, 45)[1], p, { sw: 1.8 }); }
      else { var puffs = 3 + Math.floor(r() * 3); for (i = 0; i < puffs; i++) g += el('circle', { cx: 22 + r() * 56, cy: 14 + r() * 22, r: 2.5 + r() * 3.5, fill: p[0], opacity: 0.55, stroke: p[4], 'stroke-width': 1 }); g += shape('M26 70C14 74 12 84 22 88C18 80 26 78 30 76Z', p[0], p); }
      return g + eyesR(42, 58, 5.6, 16, p) + smile(50, 69, 4, p, !o.drop);
    },
    mole: function (p, q, r) {
      var g = ground(50, 30);
      g += ball(36, 86, 10, 5, p, 0, { flat: 1 }) + ball(64, 86, 10, 5, p, 0, { flat: 1 });
      g += ball(50, 62, 26, 27, p, 0) + ball(50, 68, 15, 15, [p[1], p[2], p[3], p[3], p[4]], 0, { sw: 0.1, flat: 1 });
      g += ball(54, 36, 19, 17, p, 0, { gloss: 1 });
      g += shape('M38 22C40 12 66 10 70 22C64 18 46 18 38 22Z', q[1], q) + ball(54, 15, 5, 4.4, q, 0, { sw: 1.8, gloss: 1 }) + el('path', { d: 'M54 8L54 3M47 10L44 6M61 10L64 6', stroke: q[3], 'stroke-width': 1.8, 'stroke-linecap': 'round', fill: 'none' });
      g += ball(72, 42, 7, 5.5, [p[2], p[3], p[3], p[3], p[4]], 0, { flat: 1 }) + el('ellipse', { cx: 77, cy: 41, rx: 3, ry: 2.6, fill: '#e98aa0', stroke: p[4], 'stroke-width': 1.4 });
      [[20, 60, -1], [80, 60, 1]].forEach(function (c) { g += ball(c[0], c[1], 8, 7, p, 0, { flat: 1 }); for (var i = -1; i <= 1; i++) g += shape('M' + f(c[0] + c[2] * 5 + i * 1) + ' ' + f(c[1] + i * 5 - 2) + 'l' + f(c[2] * 9) + ' ' + f(i * 2 + 1) + 'l' + f(-c[2] * 8) + ' ' + f(3) + 'Z', '#efe6d2', p, { sw: 1.5 }); });
      return g + eye(50, 34, 3.2, p) + eye(62, 33, 3.2, p) + smile(62, 46, 3, p);
    },
    serpent: function (p, q, r) {
      var g = ground(48, 36), d = 'M10 84C24 92 40 88 40 76C40 62 18 62 20 46C22 30 48 28 60 40C66 46 68 52 74 50';
      g += el('path', { d: d, stroke: p[4], 'stroke-width': 19.5, fill: 'none', 'stroke-linecap': 'round' }) + el('path', { d: d, stroke: p[0], 'stroke-width': 15, fill: 'none', 'stroke-linecap': 'round' });
      g += el('path', { d: d, stroke: p[1], 'stroke-width': 9.5, fill: 'none', 'stroke-linecap': 'round', transform: 'translate(-1.4 -1.8)' }) + el('path', { d: d, stroke: p[2], 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '7 9', transform: 'translate(-2.6 -3.4)' });
      g += shape('M24 38C20 24 30 16 38 20C34 26 36 30 40 32Z', q[1], q) + shape('M8 84C2 78 2 90 -2 92C6 94 10 90 12 86Z', q[1], q);
      g += ball(78, 46, 14, 12, p, -10, { gloss: 1 }) + shape('M70 35C72 24 82 22 86 28C82 30 80 34 78 36Z', q[1], q) + shape('M66 56C66 64 72 68 78 64C74 62 72 58 72 56Z', q[1], q);
      return g + eyesR(75, 43, 4.2, 9.5, p) + smile(85, 52, 3, p);
    },
    stag: function (p, q, r) {
      var g0 = ground(48, 34), g = '', i, tips = [0, 45, 120, 200, 275, 320];
      g += limb(30, 62, 27, 89, 5.5, p) + limb(58, 62, 61, 89, 5.5, p);
      g += ball(44, 56, 25, 15, p, -3) + ball(18, 52, 5, 4, p, -30, { flat: 1 });
      g += limb(38, 66, 36, 90, 6, p) + limb(64, 66, 67, 90, 6, p);
      g += limb(64, 50, 72, 30, 10, p) + ball(77, 27, 12, 10.5, p, 8, { gloss: 1 }) + ball(88, 31, 5.4, 4.4, p, 10, { flat: 1 }) + el('ellipse', { cx: 91.5, cy: 30, rx: 2, ry: 1.7, fill: p[4] });
      g += shape('M66 22L58 17L66 27Z', p[1], p, { sw: 1.8 });
      [[72, 18, -1], [80, 17, 1]].forEach(function (b, k) {
        var x = b[0], y = b[1], s = b[2], d = 'M' + x + ' ' + y + 'L' + f(x + s * 5) + ' ' + f(y - 12) + 'L' + f(x + s * 2) + ' ' + f(y - 22) + 'M' + f(x + s * 5) + ' ' + f(y - 12) + 'L' + f(x + s * 13) + ' ' + f(y - 17) + 'M' + f(x + s * 3.4) + ' ' + f(y - 7) + 'L' + f(x + s * 10) + ' ' + f(y - 6);
        g += el('path', { d: d, stroke: p[4], 'stroke-width': 5.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) + el('path', { d: d, stroke: '#f3ecd8', 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        [[x + s * 2, y - 22], [x + s * 13, y - 17], [x + s * 10, y - 6]].forEach(function (t, j) { g += el('circle', { cx: t[0], cy: t[1], r: 2.8, fill: hsl(tips[(k * 3 + j) % 6], 80, 62), stroke: p[4], 'stroke-width': 1.2 }); });
      });
      for (i = 0; i < 3; i++) g += el('circle', { cx: 34 + i * 9 + r() * 3, cy: 50 + r() * 6, r: 1.8, fill: p[3] });
      return g0 + '<g transform="translate(3 17) scale(0.82)">' + g + eyesR(74, 25, 3.8, 8, p) + smile(84, 35, 2.4, p) + '</g>';
    }
  };
  var FORM_OPT = { thistlehog: { spikes: 1, ear: 'round' }, emberpup: { tail: 'flame', ear: 'point' }, glowmoth: { moth: 1 }, dewsprite: { drop: 1 } };
  var cache = {};
  A.species = function (id, o) {
    o = o || {}; var key = 's:' + id + (o.silhouette ? ':sil' : ''); if (cache[key]) return cache[key];
    var sp = ML.SPECIES_BY_ID[id], L = LOOK[id], p = A.pal(L[0], L[1], L[2]), q = A.pal(L[3], 70, 58), r = ML.mulberry(ML.hash32('art:' + id));
    if (o.silhouette) { p = ['#2a3150', '#333b5e', '#3c4570', '#465080', '#151a30']; q = p; }
    return (cache[key] = svg(FORMS[sp.form](p, q, r, FORM_OPT[id]), o.silhouette ? 'Unknown creature' : sp.name));
  };

  /* ---------- raiders: nervous chibi adventurers, facing LEFT ---------- */
  var RLOOK = { squire: [212, 30, 56], pyro: [8, 70, 48], frostarcher: [198, 52, 52], cutpurse: [130, 34, 38], stormcaller: [48, 78, 54], hexer: [282, 44, 42] };
  A.raider = function (id, o) {
    o = o || {}; var key = 'r:' + id + (o.captain ? ':c' : '') + (o.gilded ? ':g' : ''); if (cache[key]) return cache[key];
    var L = RLOOK[id], p = o.gilded ? A.pal(46, 85, 56) : A.pal(L[0], L[1], L[2]), skin = SKIN, metal = o.gilded ? A.pal(48, 90, 62) : A.pal(215, 12, 66), wood = A.pal(28, 45, 38), g = ground(50, 24);
    g += limb(42, 72, 40, 89, 7, A.pal(L[0], 20, 28)) + limb(58, 72, 60, 89, 7, A.pal(L[0], 20, 28));
    if (id === 'squire') g += shape('M60 50L74 46L76 70L62 76Z', metal[1], metal) + shape('M66 52L66 70M61 60L75 58', metal[3], metal, { sw: 1.6 });
    g += shape('M34 50C34 42 66 42 66 50L70 76L30 76Z', p[0], p) + shape('M37 51C38 46 60 45 61 51L63 72L34 72Z', p[1], p, { noline: 1 }) + shape('M39 52C40 49 50 48 50 52L49 66L37 66Z', p[2], p, { noline: 1 });
    g += shape('M31 66L69 66L69 71L31 71Z', wood[1], wood, { sw: 1.6 });
    g += ball(50, 32, 15, 14.5, skin, 0, {});
    // headgear + weapon by class
    if (id === 'squire') { g += shape('M35 30C35 14 65 14 65 30L65 26L35 26Z', metal[1], metal) + shape('M35 30L65 30L65 25L35 25Z', metal[0], metal, { sw: 1.6 }) + shape('M48 16L52 16L52 8L48 8Z', p[1], p, { sw: 1.6 }); g += limb(34, 56, 22, 60, 6, p) + shape('M24 62L6 30L10 28L28 58Z', metal[2], metal) + shape('M18 56L30 50', wood[1], wood, { sw: 4 }); }
    if (id === 'pyro') { g += shape('M33 34C30 12 70 12 67 34C60 26 40 26 33 34Z', p[0], p) + shape('M50 13L62 2L58 16Z', p[1], p); g += limb(34, 56, 24, 62, 6, p) + shape('M22 90L22 30', wood[1], wood, { sw: 4.4 }) + shape('M22 30C12 24 16 12 22 6C22 12 30 14 28 22C32 20 31 16 31 14C36 22 30 30 22 30Z', '#ff8a3c', A.pal(14, 80, 50)) + shape('M22 27C18 24 19 18 22 15C23 19 26 20 24 26Z', '#ffe08a', p, { noline: 1 }); }
    if (id === 'frostarcher') { g += shape('M33 36C30 12 70 12 67 36C62 24 38 24 33 36Z', p[1], p) + shape('M60 18L72 8L66 24Z', p[0], p); g += limb(34, 56, 24, 56, 6, p) + el('path', { d: 'M22 26C6 42 6 70 22 86', stroke: wood[4], 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }) + el('path', { d: 'M22 26C6 42 6 70 22 86', stroke: wood[2], 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }) + el('path', { d: 'M22 26L22 86', stroke: '#e8f4ff', 'stroke-width': 1.2 }) + shape('M30 56L4 56M4 56L10 52M4 56L10 60', '#bfe6ff', A.pal(200, 60, 40), { sw: 2 }); }
    if (id === 'cutpurse') { g += shape('M34 30C34 14 66 14 66 30C58 24 42 24 34 30Z', p[0], p) + shape('M35 36L65 36L65 43L35 43Z', p[0], p, { sw: 1.6 }); g += limb(34, 56, 22, 50, 6, p) + shape('M22 50L8 42L10 39L25 46Z', metal[2], metal, { sw: 1.8 }) + limb(66, 56, 76, 64, 6, p) + ball(80, 68, 6, 7, wood, 0, { flat: 1, sw: 1.8 }); }
    if (id === 'stormcaller') { g += shape('M28 26L72 26L66 20C62 4 38 4 34 20Z', p[1], p) + shape('M30 27L70 27', p[4], p, { sw: 3 }); g += limb(34, 56, 24, 58, 6, p) + shape('M22 90L22 34', metal[1], metal, { sw: 4 }) + shape('M24 10L14 24L21 24L17 36L30 20L23 20Z', '#ffe45c', A.pal(48, 90, 45), { sw: 1.8 }); }
    if (id === 'hexer') { g += shape('M30 30L70 30L58 22L54 2L44 22Z', p[1], p) + shape('M44 22L58 22L57 17L46 17Z', A.pal(300, 60, 60)[1], p, { sw: 1.4 }); g += limb(34, 56, 24, 54, 6, p) + ball(18, 50, 8.5, 8.5, A.pal(292, 70, 58), 0, { gloss: 1, sw: 1.8 }) + el('path', { d: 'M14 50a4 4 0 1 0 8 0a2.4 2.4 0 1 0-4.8 0', stroke: '#2a1140', 'stroke-width': 1.3, fill: 'none' }); }
    g += eye(43, 34, 3.6, skin, 'worry') + eye(55, 34, 3.6, skin, 'worry') + el('path', { d: 'M45 42Q49 40 53 42', stroke: skin[4], 'stroke-width': 1.7, fill: 'none', 'stroke-linecap': 'round' });
    g += el('path', { d: 'M66 22q3 -5 0 -9', stroke: '#9fd8ff', 'stroke-width': 1.8, fill: 'none', 'stroke-linecap': 'round' });
    if (o.captain) g += shape('M38 14L40 2L46 9L50 0L54 9L60 2L62 14Z', '#ffd24a', A.pal(44, 90, 45), { sw: 1.8 }) + el('circle', { cx: 50, cy: 9, r: 1.8, fill: '#e2475a' });
    if (o.gilded) g += el('path', { d: 'M12 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM84 40l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z', fill: '#fff3b0', stroke: '#a6791a', 'stroke-width': 1 });
    return (cache[key] = svg(g, (o.captain ? 'Captain ' : o.gilded ? 'Gilded ' : '') + ML.RAIDER_BY_ID[id].name));
  };

  /* ---------- the healer, facing right ---------- */
  A.healer = function () {
    if (cache.healer) return cache.healer;
    var robe = A.pal(158, 40, 40), trim = A.pal(44, 70, 62), skin = SKIN, wood = A.pal(28, 40, 36), g = ground(46, 28);
    g += shape('M80 92L80 16', wood[1], wood, { sw: 4.4 }) + shape('M80 16C80 8 89 8 89 16', wood[1], wood, { sw: 3.2 }) + el('path', { d: 'M89 16L89 22', stroke: wood[4], 'stroke-width': 1.6 });
    g += el('circle', { cx: 89, cy: 30, r: 10, fill: '#ffe9a3', opacity: 0.25 }) + shape('M83.5 23L94.5 23L93 37L85 37Z', '#ffe08a', A.pal(44, 80, 40), { sw: 1.8 }) + el('ellipse', { cx: 89, cy: 31, rx: 2.4, ry: 3.8, fill: '#fffbe6' });
    g += shape('M26 92C24 66 32 48 46 48C60 48 68 66 66 92Z', robe[0], robe) + shape('M30 89C29 68 36 53 45 53C54 53 60 66 60 86Z', robe[1], robe, { noline: 1 }) + shape('M34 80C34 66 39 57 44 57C47 60 44 70 42 84Z', robe[2], robe, { noline: 1 });
    g += shape('M42 50L50 50L52 92L40 92Z', trim[1], trim, { sw: 1.6 }) + limb(58, 60, 76, 56, 7, robe) + ball(79.5, 56, 4.4, 4.2, skin, 0, { flat: 1, sw: 1.8 });
    g += shape('M26 38C24 14 68 14 66 38C66 48 58 54 46 54C34 54 26 48 26 38Z', robe[0], robe) + shape('M30 36C30 20 60 18 61 35C56 28 38 28 30 36Z', robe[1], robe, { noline: 1 });
    g += ball(48, 38, 12.5, 11.5, skin, 0, { sw: 1.8 }) + shape('M35 34C40 24 56 24 61 34C54 30 42 30 35 34Z', A.pal(30, 50, 30)[1], robe, { sw: 1.4 });
    g += eye(45, 39, 3.2, skin) + eye(55, 39, 3.2, skin) + smile(50, 45, 2.6, skin);
    g += shape('M22 30C18 24 22 18 28 20C24 24 26 28 30 30Z', A.pal(120, 45, 45)[1], robe, { sw: 1.6 });
    return (cache.healer = svg(g, 'The healer'));
  };

  /* ---------- icons (24-unit grid, currentColor where single-colour) ---------- */
  var ICON = {
    grace: '<path d="M12 21s-7-4.6-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.4-7 10-7 10z"/><path d="M12 9.5v6M9 12.5h6"/>',
    spirit: '<path d="M12 3c3 4 6 6.6 6 10.4A6 6 0 0 1 6 13.4C6 9.6 9 7 12 3z"/><path d="M9.4 14.2a2.8 2.8 0 0 0 2.8 2.8"/>',
    ward: '<path d="M12 3l7.5 3v5.4c0 4.6-3.1 8-7.5 9.6-4.4-1.6-7.5-5-7.5-9.6V6z"/><path d="M8.6 12l2.4 2.4 4.4-4.8"/>',
    tempo: '<circle cx="12" cy="13" r="7.5"/><path d="M12 8.5V13l3 2M9.5 2.8h5"/>',
    fortune: '<path d="M12 3.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2 6.8 19.1 8 13.3l-4.4-4 5.9-.7z"/>',
    mend: '<path d="M12 20.5s-7-4.4-7-9.6a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 5.2-7 9.6-7 9.6z"/>',
    bloomwave: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3.5c2 2 2 4 0 5.9-2-1.9-2-3.9 0-5.900zM12 20.5c-2-2-2-4 0-5.9 2 1.9 2 3.900 0 5.900zM3.5 12c2-2 4-2 5.900 0-1.900 2-3.900 2-5.900 0zM20.5 12c-2 2-4 2-5.900 0 1.900-2 3.900-2 5.900 0z"/>',
    dew: '<path d="M8 4c2 2.800 4 4.600 4 7.200a4 4 0 0 1-8 0C4 8.600 6 6.800 8 4z"/><path d="M16.500 11c1.400 2 2.800 3.200 2.800 5a2.800 2.800 0 0 1-5.600 0c0-1.800 1.400-3 2.800-5z"/>',
    barkskin: '<path d="M12 3l7.500 3v5.400c0 4.600-3.100 8-7.500 9.600-4.400-1.600-7.500-5-7.500-9.600V6z"/><path d="M12 6.500v12M8.500 9.500l3.500 2.500 3.500-2.500M8.500 14l3.500 2 3.500-2"/>',
    purify: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.600 5.600l2.800 2.800M15.600 15.600l2.800 2.800M18.400 5.600l-2.800 2.800M8.400 15.600l-2.800 2.800"/><circle cx="12" cy="12" r="2.400"/>',
    rally: '<path d="M6 21V4M6 4.500c4-2 6 2 12 0v8c-6 2-8-2-12 0"/>',
    coin: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500v9M14.500 9.600c-.6-1-1.500-1.400-2.500-1.400-1.500 0-2.600.8-2.600 2 0 2.800 5.400 1.200 5.400 4 0 1.200-1.200 2-2.800 2-1.200 0-2.200-.5-2.800-1.500"/>',
    mote: '<path d="M12 2.500l2.400 7.100 7.100 2.400-7.100 2.400L12 21.500l-2.400-7.100L2.500 12l7.100-2.400z"/>',
    insight: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/>',
    keystone: '<path d="M8 3h8l4 7-8 11L4 10z"/><path d="M4 10h16M8 3l4 7 4-7"/>',
    quests: '<path d="M6 3h10l3 3v15H6z"/><path d="M9 9h7M9 13h7M9 17h4"/>', healer: '<circle cx="12" cy="8" r="4"/><path d="M4.500 21c0-4.200 3.300-7 7.500-7s7.500 2.800 7.500 7"/>',
    skills: '<path d="M4 5c3-1.500 5.500-1.500 8 0 2.500-1.500 5-1.500 8 0v14c-3-1.500-5.500-1.500-8 0-2.500-1.500-5-1.500-8 0z"/><path d="M12 5v14"/>', upgrades: '<path d="M12 20V6M6 11l6-6 6 6"/><path d="M5 20h14"/>',
    gear: '<path d="M4 9h16v11H4z"/><path d="M4 9l2-4h12l2 4M12 9v11M9 5c0-2.500 3-2.500 3 0 0-2.500 3-2.500 3 0"/>', companions: '<circle cx="7" cy="8" r="2"/><circle cx="12" cy="5.500" r="2"/><circle cx="17" cy="8" r="2"/><path d="M12 11c-3.500 0-6 2.600-6 5.400 0 2 1.600 3.100 3.200 3.100 1.200 0 1.800-.6 2.800-.6s1.600.6 2.800.6c1.600 0 3.200-1.100 3.200-3.100 0-2.800-2.500-5.400-6-5.400z"/>',
    shop: '<path d="M4 9l1.500-5h13L20 9M4 9v11h16V9M4 9c0 2 2.700 2 2.700 0 0 2 2.600 2 2.600 0 0 2 2.700 2 2.700 0 0 2 2.700 2 2.700 0 0 2 2.600 2 2.600 0 0 2 2.700 2 2.700 0"/><path d="M9.500 20v-5h5v5"/>', sanctuary: '<path d="M3 11l9-7 9 7M5.500 9.500V20h13V9.500"/><path d="M10 20v-5.500h4V20"/>',
    world: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>', sabbatical: '<path d="M20 14.500A8.500 8.500 0 1 1 9.500 4a7 7 0 0 0 10.500 10.500z"/>',
    store: '<path d="M5 9h14l-1.300 11.500H6.300z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M12 11.800l.9 2.300 2.300.9-2.300.9-.9 2.300-.9-2.300-2.300-.9 2.300-.9z"/>', ledger: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><path d="M5 17.500h14M9 7.500h6M9 11h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M18.700 5.300l-2.100 2.100M7.400 16.600l-2.100 2.100"/>',
    lock: '<path d="M6 11h12v9.500H6z"/><path d="M8.500 11V7.500a3.500 3.500 0 0 1 7 0V11"/>', bulwark: '<path d="M12 3l7.500 3v5.400c0 4.600-3.100 8-7.500 9.600-4.400-1.600-7.500-5-7.500-9.600V6z"/>', striker: '<path d="M5 19l9-9M14 5l5 5M12.500 6.500l5 5M5 19l-1.500 1.500"/>',
    mender: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>', forager: '<path d="M5 9h14l-1.500 11h-11z"/><path d="M8.500 9a3.500 3.500 0 0 1 7 0"/>',
    burn: '<path d="M12 3c1 3.500 5 5.200 5 10a5 5 0 0 1-10 0c0-2 1-3.200 2-4.200.2 1.700 1 2.400 1.800 2.700C10.500 8.500 11 5.500 12 3z"/>', chill: '<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2"/>',
    poison: '<path d="M9 3h6M10 3v5.500L5.500 18a2 2 0 0 0 1.800 3h9.400a2 2 0 0 0 1.800-3L14 8.500V3"/><path d="M7.800 14.500h8.400"/>', shock: '<path d="M13.500 2.500L5 13.500h6l-1.500 8L18.500 10h-6z"/>', curse: '<circle cx="12" cy="10.500" r="7"/><path d="M9 20.500h6M9.500 17v3.500M14.500 17v3.500"/><circle cx="9.300" cy="10" r="1.400"/><circle cx="14.700" cy="10" r="1.400"/>',
    focus: '<path d="M6 21L17 4M15.500 3l3.500 2-2 3.200"/><circle cx="17.500" cy="5" r="2.600"/>', vestment: '<path d="M8 3l4 2.500L16 3l5 4-2.500 3.500L17 9.500V21H7V9.500L5.500 10.500 3 7z"/>', charm: '<path d="M7 3c0 4 10 4 10 0"/><path d="M12 6v4"/><path d="M12 10l4 4-4 6.500L8 14z"/>',
    auto: '<path d="M4 12a8 8 0 0 1 13.700-5.700L20 8.500M20 4v4.500h-4.500M20 12a8 8 0 0 1-13.700 5.700L4 15.500M4 20v-4.500h4.500"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.300 9.300a2.800 2.800 0 1 1 3.700 2.700c-.7.300-1 .8-1 1.500v.5M12 17.200v.1"/>',
    sound: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z"/><path d="M15.500 9a4.200 4.200 0 0 1 0 6M18 6.500a7.700 7.700 0 0 1 0 11"/>', mutedicon: '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>',
    bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21.500h4"/>',
    up: '<path d="M6 14l6-6 6 6"/>', down: '<path d="M6 10l6 6 6-6"/>',
    // three stage controls used to share two chevrons between them, which made them indistinguishable
    pause: '<path d="M9 5v14M15 5v14"/>', play: '<path d="M8 5l11 7-11 7z"/>',
    zenin: '<path d="M4 4h6M4 4v6M20 20h-6M20 20v-6M10 10L4 4M14 14l6 6"/>',
    zenout: '<path d="M10 4H4v6M14 20h6v-6M4 4l6 6M20 20l-6-6"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    contract: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>', check: '<path d="M4.500 12.500l5 5 10-11"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', hand: '<path d="M8 12V5.500a1.500 1.500 0 0 1 3 0V11M11 10.500V4.500a1.500 1.500 0 0 1 3 0v6M14 11V6a1.500 1.500 0 0 1 3 0v8.500c0 3.600-2.400 6.500-6 6.500-2.600 0-4-1.200-5.200-3.200L3.600 14a1.500 1.500 0 0 1 2.600-1.500L8 15"/>'
  };
  A.icon = function (name, cls) { var d = ICON[name] || ICON.help; return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; };
  A.iconNames = function () { return Object.keys(ICON); };

  /* ---------- small coloured objects: materials, offerings, gifts ---------- */
  var MAT_HUE = { fieldstone: [90, 12, 58, 'stone'], alderwood: [28, 45, 42, 'wood'], dewglass: [170, 50, 66, 'glass'], basalt: [250, 10, 30, 'stone'], charwood: [16, 30, 24, 'wood'], emberglass: [18, 85, 58, 'glass'], icestone: [205, 30, 78, 'stone'], silverbirch: [50, 10, 84, 'wood'], mirrorglass: [265, 40, 76, 'glass'] };
  A.mat = function (id) {
    var key = 'm:' + id; if (cache[key]) return cache[key]; var m = MAT_HUE[id], p = A.pal(m[0], m[1], m[2]), g = '', r = ML.mulberry(ML.hash32('mat:' + id)), i;
    function j(v, a) { return f(v + (r() - 0.5) * a); }
    if (m[3] === 'stone') { g = shape('M' + j(3, 2) + ' ' + j(17, 2) + 'L' + j(6, 2) + ' ' + j(8, 3) + 'L' + j(13, 3) + ' ' + j(5, 2) + 'L' + j(20, 2) + ' ' + j(9, 3) + 'L' + j(21, 1) + ' ' + j(17, 2) + 'L' + j(14, 3) + ' 20L' + j(6, 2) + ' 20Z', p[0], p, { sw: 1.5 }) + shape('M6 15L' + j(8, 2) + ' 9L13 7L' + j(17, 2) + ' 10L12 12Z', p[1], p, { noline: 1 }) + shape('M8 11L9 9.5L12 8.5L11 10.5Z', p[3], p, { noline: 1 }); for (i = 0; i < 2 + Math.floor(r() * 3); i++) g += el('circle', { cx: 7 + r() * 11, cy: 13 + r() * 5, r: 0.7 + r() * 0.6, fill: p[4], opacity: 0.5 }); }
    if (m[3] === 'wood') { var tilt = 2 + r() * 3; g = shape('M3 ' + f(7 + tilt) + 'L17 6L21 9L21 16L7 ' + f(16 + tilt) + 'L3 16Z', p[0], p, { sw: 1.5 }) + shape('M3 ' + f(7 + tilt) + 'L17 6L21 9L7 ' + f(10 + tilt) + 'Z', p[1], p, { sw: 1.2 }) + el('ellipse', { cx: 5, cy: 13.5, rx: 1.8, ry: 3, fill: p[2], stroke: p[4], 'stroke-width': 1, transform: 'rotate(-8 5 13.5)' }); for (i = 0; i < 1 + Math.floor(r() * 3); i++) g += el('path', { d: 'M' + j(10 + i * 3, 2) + ' ' + j(13 + i, 1) + 'l' + f(2 + r() * 3) + ' -0.6', stroke: id === 'silverbirch' ? p[4] : p[3], 'stroke-width': 1.1, 'stroke-linecap': 'round' }); }
    if (m[3] === 'glass') { var w = 5.5 + r() * 2.5, sh = 8 + r() * 3; g = shape('M12 2L' + f(12 + w) + ' ' + f(sh) + 'L12 22L' + f(12 - w) + ' ' + f(sh) + 'Z', p[0], p, { sw: 1.5 }) + shape('M12 4L' + f(12 + w - 2) + ' ' + f(sh) + 'L12 ' + f(sh) + 'Z', p[2], p, { noline: 1 }) + shape('M12 4L' + f(12 - w + 2) + ' ' + f(sh) + 'L12 ' + f(sh) + 'Z', p[1], p, { noline: 1 }) + shape('M9 ' + f(sh + 1) + 'L11 ' + f(sh + 1) + 'L11 ' + f(sh + 7) + 'Z', p[3], p, { noline: 1 }); if (r() < 0.7) g += shape('M' + f(17 + r() * 2) + ' ' + f(14 + r() * 3) + 'l2 3l-2 4l-2 -4Z', p[1], p, { sw: 1 }); }
    return (cache[key] = svg(g, ML.MATS[id], '0 0 24 24'));
  };
  var OFF_HUE = { plain: [36, 55, 62], green: [125, 50, 46], yellow: [46, 90, 58], red: [10, 80, 50], purple: [285, 50, 45], blue: [200, 65, 66] };
  A.offering = function (c) { var key = 'o:' + c; if (cache[key]) return cache[key]; var p = A.pal.apply(null, OFF_HUE[c]), leaf = A.pal(120, 45, 42); return (cache[key] = svg(ball(12, 14, 7.500, 6.500, p, 0, { sw: 1.5, gloss: 1 }) + shape('M12 8C12 4 15 3 18 3C18 6 15 8 12 8Z', leaf[1], leaf, { sw: 1.3 }), ML.OFFERING_NAME[c], '0 0 24 24')); };
  var RAR_HUE = [[220, 8, 62], [125, 45, 52], [208, 70, 58], [280, 60, 62], [42, 95, 58]];
  A.gear = function (type, rarity) {
    var key = 'g:' + type + ':' + rarity; if (cache[key]) return cache[key];
    var def = ML.GEAR_BY_ID[type], r = ML.mulberry(ML.hash32('gear:' + type)), hue = [110, 18, 200][def.region] + r() * 40, p = A.pal(hue, 45, 50), rp = A.pal.apply(null, RAR_HUE[rarity]), wood = A.pal(28, 40, 38), g = '';
    g += el('rect', { x: 1.500, y: 1.500, width: 45, height: 45, rx: 8, fill: rp[0], opacity: 0.22, stroke: rp[1], 'stroke-width': 2 });
    var idx = ML.GEAR.filter(function (x) { return x.slot === def.slot; }).indexOf(def);   // index within its slot: geometry is assigned, not rolled, so no two gifts can collide
    if (def.slot === 'focus') {
      var lean = 10 + idx * 1.5; g += shape('M' + f(24 - lean) + ' 42L' + f(22 + lean * 0.6) + ' 14', wood[1], wood, { sw: 4 }); var tx = 23 + lean * 0.6, ty = 11;
      g += [ball(tx, ty, 6.5, 6.5, p, 0, { sw: 1.6, gloss: 1 }),
        shape('M' + f(tx) + ' 2L' + f(tx + 6) + ' 11L' + f(tx) + ' 20L' + f(tx - 6) + ' 11Z', p[1], p, { sw: 1.6 }) + shape('M' + f(tx) + ' 5L' + f(tx + 3) + ' 11L' + f(tx) + ' 11Z', p[3], p, { noline: 1 }),
        shape('M' + f(tx - 5) + ' 17C' + f(tx - 11) + ' 8 ' + f(tx - 3) + ' 1 ' + f(tx + 3) + ' 4C' + f(tx + 9) + ' 8 ' + f(tx + 7) + ' 16 ' + f(tx + 1) + ' 17', 'none', p, { sw: 3 }) + ball(tx + 1, ty, 3, 3, p, 0, { sw: 1.2, gloss: 1 }),
        shape('M' + f(tx) + ' 18C' + f(tx - 8) + ' 12 ' + f(tx - 4) + ' 4 ' + f(tx) + ' 1C' + f(tx) + ' 6 ' + f(tx + 6) + ' 7 ' + f(tx + 5) + ' 13C' + f(tx + 5) + ' 16 ' + f(tx + 3) + ' 18 ' + f(tx) + ' 18Z', p[1], p, { sw: 1.6 }),
        shape('M' + f(tx - 7) + ' 6L' + f(tx + 7) + ' 6L' + f(tx + 4) + ' 17L' + f(tx - 4) + ' 17Z', p[1], p, { sw: 1.6 }) + el('circle', { cx: tx, cy: 11, r: 2.4, fill: p[3] }),
        shape('M' + f(tx) + ' 2L' + f(tx + 2) + ' 9L' + f(tx + 9) + ' 11L' + f(tx + 2) + ' 13L' + f(tx) + ' 20L' + f(tx - 2) + ' 13L' + f(tx - 9) + ' 11L' + f(tx - 2) + ' 9Z', p[1], p, { sw: 1.6 })][idx % 6];
    } else if (def.slot === 'vestment') {
      var hem = [40, 37, 42, 38, 41, 36][idx % 6], sl = [22, 24, 20, 25, 21, 23][idx % 6];
      g += shape('M16 8L24 12L32 8L42 16L37 ' + sl + 'L34 20L' + f(35 + idx % 3) + ' ' + hem + 'L' + f(13 - idx % 3) + ' ' + hem + 'L14 20L11 ' + sl + 'L6 16Z', p[0], p, { sw: 1.6 }) + shape('M18 12L24 15L30 12L31 ' + (hem - 3) + 'L17 ' + (hem - 3) + 'Z', p[1], p, { noline: 1 });
      g += [shape('M22 15L26 15L26 ' + hem + 'L22 ' + hem + 'Z', rp[1], p, { sw: 1.2 }), shape('M17 28L31 28L31 32L17 32Z', rp[1], p, { sw: 1.2 }), el('circle', { cx: 24, cy: 20, r: 1.6, fill: rp[1] }) + el('circle', { cx: 24, cy: 26, r: 1.6, fill: rp[1] }) + el('circle', { cx: 24, cy: 32, r: 1.6, fill: rp[1] }), shape('M18 14L30 ' + (hem - 4) + 'M30 14L18 ' + (hem - 4), rp[1], p, { sw: 2 }), shape('M16 8L24 18L32 8', 'none', { 4: rp[1] }, { sw: 2.4 }), shape('M17 ' + (hem - 8) + 'L20 ' + (hem - 4) + 'L24 ' + (hem - 8) + 'L28 ' + (hem - 4) + 'L31 ' + (hem - 8), 'none', { 4: rp[1] }, { sw: 2 })][idx % 6];
    } else {
      g += el('path', { d: 'M12 6C12 ' + f(16 + idx) + ' 36 ' + f(16 + idx) + ' 36 6', stroke: wood[4], 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }) + el('path', { d: 'M24 ' + f(14 + idx * 0.7) + 'V11', stroke: wood[4], 'stroke-width': 2 });
      g += [ball(24, 29, 8, 9.5, p, 0, { sw: 1.6, gloss: 1 }) + shape('M20 20C20 16 28 16 28 20Z', wood[1], wood, { sw: 1.4 }),
        shape('M14 22C14 40 34 40 34 22C30 28 18 28 14 22Z', p[1], p, { sw: 1.6 }) + el('path', { d: 'M24 26C20 30 22 36 26 34', stroke: p[3], 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }),
        shape('M24 16L33 27L24 42L15 27Z', p[1], p, { sw: 1.6 }) + shape('M24 19L29 27L24 27Z', p[3], p, { noline: 1 }),
        ball(18, 28, 4, 4, p, 0, { sw: 1.4 }) + ball(24, 31, 4.6, 4.6, p, 0, { sw: 1.4, gloss: 1 }) + ball(30, 28, 4, 4, p, 0, { sw: 1.4 }),
        shape('M24 17L27 25L36 25L29 30L32 39L24 33L16 39L19 30L12 25L21 25Z', p[1], p, { sw: 1.6 }),
        ball(24, 29, 9, 9, p, 0, { sw: 1.6 }) + el('circle', { cx: 24, cy: 29, r: 4.4, fill: 'none', stroke: p[3], 'stroke-width': 1.6 }) + el('circle', { cx: 24, cy: 29, r: 1.4, fill: p[3] })][idx % 6];
    }
    return (cache[key] = svg(g, ML.RARITY[rarity] + ' ' + def.name, '0 0 48 48'));
  };

  /* ---------- region backdrops: layered depth scene, far -> near; contrast and saturation rise toward the viewer ---------- */
  A.backdrop = function (ri, theme) {
    var soft = theme !== 'lantern', key = 'b:' + ri + (soft ? ':h' : ''); if (cache[key]) return cache[key];
    var r = ML.mulberry(ML.hash32('bg:' + ri)), W = 640, H = 360, id = 'mlbg' + ri, g = '', i;
    var T = [{ sky: ['#9fd3c7', '#e9f3d2'], far: '#7fb6a3', mid: '#4f9a78', near: '#2f7a55', path: ['#d9c08a', '#c4a56c'], dark: '#1f5a40' },
             { sky: ['#f2a65a', '#f7dba0'], far: '#b9705a', mid: '#7d4a48', near: '#4a2f3a', path: ['#8a6a5c', '#6b4e46'], dark: '#2c1c26' },
             { sky: ['#b7c8f2', '#eef3ff'], far: '#a9bde0', mid: '#7f9cc9', near: '#5a78ac', path: ['#e4eefb', '#c5d6ee'], dark: '#38507e' }][ri];
    // Heather: same geometry, storybook pastels. Lilac skies, mint and mauve hills, cream paths.
    if (soft) T = [{ sky: ['#c9bdf2', '#f6ecfb'], far: '#b7aee8', mid: '#a3d0bd', near: '#84bda3', path: ['#f6ead9', '#e6d3c4'], dark: '#5b63a6' },
                   { sky: ['#f3b3c8', '#fde6d6'], far: '#dba6c8', mid: '#b98cbd', near: '#9072ad', path: ['#efd6dc', '#d8b9c9'], dark: '#574384' },
                   { sky: ['#a9b8f5', '#f0f1ff'], far: '#bcc6f4', mid: '#98a7e8', near: '#7d8bd8', path: ['#f4f6ff', '#dbe0fb'], dark: '#4a55a3' }][ri];
    function ridge(y, amp, n, fill, op) { var d = 'M0 ' + H + 'L0 ' + y, k; for (k = 0; k <= n; k++) d += 'L' + f(k * W / n) + ' ' + f(y - Math.abs(Math.sin(k * 1.7 + r() * 2)) * amp - r() * amp * 0.4); return el('path', { d: d + 'L' + W + ' ' + H + 'Z', fill: fill, opacity: op }); }
    g += '<defs><linearGradient id="' + id + 'sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="220"><stop offset="0" stop-color="' + T.sky[0] + '"/><stop offset="1" stop-color="' + T.sky[1] + '"/></linearGradient><linearGradient id="' + id + 'path" gradientUnits="userSpaceOnUse" x1="0" y1="230" x2="0" y2="360"><stop offset="0" stop-color="' + T.path[0] + '"/><stop offset="1" stop-color="' + T.path[1] + '"/></linearGradient></defs>';
    g += el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#' + id + 'sky)' });
    g += el('circle', { cx: ri === 1 ? 500 : 120, cy: 70, r: ri === 1 ? 34 : 26, fill: ri === 1 ? '#ffe2a0' : '#fffbe8', opacity: 0.85 });
    g += ridge(190, 60, 9, T.far, 0.75) + ridge(215, 40, 12, T.mid, 0.9);
    // far props
    for (i = 0; i < 7; i++) { var x = 20 + i * 95 + r() * 40, y = 214 + r() * 8, s = 0.7 + r() * 0.5;
      if (ri === 0) g += el('path', { d: 'M' + f(x) + ' ' + f(y) + 'l0 ' + f(-16 * s), stroke: T.dark, 'stroke-width': 3 * s }) + el('ellipse', { cx: x, cy: y - 26 * s, rx: 15 * s, ry: 17 * s, fill: T.near }) + el('ellipse', { cx: x - 4 * s, cy: y - 30 * s, rx: 8 * s, ry: 9 * s, fill: T.mid });
      if (ri === 1) g += el('path', { d: 'M' + f(x - 18 * s) + ' ' + f(y) + 'L' + f(x - 4 * s) + ' ' + f(y - 40 * s) + 'L' + f(x + 5 * s) + ' ' + f(y - 34 * s) + 'L' + f(x + 20 * s) + ' ' + f(y) + 'Z', fill: T.near }) + el('path', { d: 'M' + f(x - 4 * s) + ' ' + f(y - 40 * s) + 'l3 12l-5 8', stroke: '#ff9a4a', 'stroke-width': 2, fill: 'none', opacity: 0.9 });
      if (ri === 2) g += el('path', { d: 'M' + f(x - 10 * s) + ' ' + f(y) + 'L' + f(x) + ' ' + f(y - 46 * s) + 'L' + f(x + 10 * s) + ' ' + f(y) + 'Z', fill: '#dfe9fb' }) + el('path', { d: 'M' + f(x) + ' ' + f(y - 46 * s) + 'L' + f(x + 10 * s) + ' ' + f(y) + 'L' + f(x + 2 * s) + ' ' + f(y) + 'Z', fill: T.mid, opacity: 0.6 }); }
    g += el('rect', { x: 0, y: 226, width: W, height: 134, fill: T.near });
    g += el('path', { d: 'M0 246C160 234 480 234 640 246L640 336C480 346 160 346 0 336Z', fill: 'url(#' + id + 'path)' });
    for (i = 0; i < 26; i++) { var px = r() * W, py = 250 + r() * 80; g += el('ellipse', { cx: px, cy: py, rx: 3 + r() * 7, ry: 1.2 + r() * 1.6, fill: T.path[1], opacity: 0.55 }); }
    for (i = 0; i < 16; i++) { var tx = r() * W, top = r() < 0.5, ty = top ? 234 + r() * 10 : 340 + r() * 12; g += el('path', { d: 'M' + f(tx) + ' ' + f(ty) + 'q-3 -10 -7 -12M' + f(tx) + ' ' + f(ty) + 'q0 -12 2 -16M' + f(tx) + ' ' + f(ty) + 'q4 -9 8 -10', stroke: ri === 2 ? '#eaf2ff' : T.dark, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.9 }); }
    // sanctuary gate on the left: what the line is protecting
    g += el('path', { d: 'M0 236L34 236L34 170C34 150 0 150 0 150Z', fill: T.dark }) + el('path', { d: 'M6 236L6 176C6 162 28 162 28 176L28 236Z', fill: '#ffe9a3', opacity: 0.55 }) + el('circle', { cx: 17, cy: 150, r: 6, fill: '#ffe08a' });
    if (soft) { var r2 = ML.mulberry(ML.hash32('bgsoft:' + ri)), sky = '';   // own stream: the scene's geometry is identical in both themes
      for (i = 0; i < 9; i++) { var sx = 40 + r2() * 560, sy = 14 + r2() * 110, ss = 2.2 + r2() * 3.2; sky += el('path', { d: 'M' + f(sx) + ' ' + f(sy - ss) + 'Q' + f(sx) + ' ' + f(sy) + ' ' + f(sx + ss) + ' ' + f(sy) + 'Q' + f(sx) + ' ' + f(sy) + ' ' + f(sx) + ' ' + f(sy + ss) + 'Q' + f(sx) + ' ' + f(sy) + ' ' + f(sx - ss) + ' ' + f(sy) + 'Q' + f(sx) + ' ' + f(sy) + ' ' + f(sx) + ' ' + f(sy - ss) + 'Z', fill: '#ffffff', opacity: f(0.55 + r2() * 0.4) }); }
      for (i = 0; i < 3; i++) { var cx = 90 + i * 210 + r2() * 60, cy = 40 + r2() * 50; sky += el('path', { d: 'M' + f(cx - 30) + ' ' + f(cy) + 'a10 10 0 0 1 14 -9a14 14 0 0 1 26 -3a11 11 0 0 1 18 12Z', fill: '#ffffff', opacity: 0.6 }); }
      g = g.replace('<circle', sky + '<circle'); }
    return (cache[key] = svg(g, ML.REGIONS[ri].name, '0 0 ' + W + ' ' + H));
  };
  A.uri = function (svgStr) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr); };
  // geometry-only fingerprint (colours stripped) for the set-uniqueness gate
  A.fingerprint = function (svgStr) { return ML.hash32(svgStr.replace(/#[0-9a-fA-F]{3,8}/g, '#').replace(/<title>[^<]*<\/title>/, '')); };
})(globalThis.ML = globalThis.ML || {});
