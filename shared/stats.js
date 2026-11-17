/* Visit counter for the dhseadev.online Jetpack Stats blog, counted against the /play/ page.
 *
 * First-party on purpose. Jetpack's own counter (stats.wp.com/e-*.js) only builds one
 * Image request to pixel.wp.com, so this sends that same request itself. That keeps
 * script-src 'self': this origin stores visitors' own API keys in localStorage, and a
 * third-party script host would be code execution next to them (see public/_headers).
 * Only img-src names pixel.wp.com. Parameters and their order mirror the vendor "view"
 * handler; update POST here if the counted page changes. */
(function () {
  try {
    var q = {
      v: 'ext', blog: '255484707', post: '233', tz: '-6', srv: 'dhseadev.online',
      hp: 'atomic', ac: '2', amp: '0', j: '1:16.5-a.3',
      host: document.location.host, ref: document.referrer, fcp: 0
    };
    var p = window.performance && window.performance.getEntriesByType && window.performance.getEntriesByType('paint');
    for (var i = 0; p && i < p.length; i++) if (p[i].name === 'first-contentful-paint') q.fcp = Math.round(p[i].startTime);
    new URLSearchParams(window.location.search).forEach(function (v, k) { if (k.indexOf('utm_') === 0) q[k] = v; });
    var parts = [];
    for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
    var img = new Image();
    img.src = 'https://pixel.wp.com/g.gif?' + parts.join('&') + '&rand=' + Math.random();
    img.alt = ''; img.width = 6; img.height = 5;
  } catch (e) { /* counting must never break a page */ }
})();
