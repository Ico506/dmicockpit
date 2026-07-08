/* ============================================================
   DMICOckpit P3 — Carousel Forge
   Canvas slide renderer. Text slides in the dmico-hub visual
   language, exported as PNG sets in two sizes:
   IG 1080x1350 (4:5) and XHS 1242x1656 (3:4).
   Depends on app.js globals: state, save, $, el, getPersona,
   getCard, charLen. Loaded AFTER app.js.
   ============================================================ */
'use strict';

/* palette mirror of style.css :root (canvas can't read CSS vars w/o DOM) */
var FORGE_COLORS = {
  paper: '#F4EBD2',
  surface: '#FEFAE0',
  ink: '#45301E',
  inkSoft: '#7C6A4F',
  inkFaint: '#A89A7C',
  line: '#E3D7BA',
  accent: '#5F6F52',
  accentDeep: '#4B5840',
  lantern: '#C4661F',
  clay: '#8A3F1E',
  amber: '#B08A2A'
};

var FORGE_SIZES = {
  ig: { w: 1080, h: 1350, tag: 'ig' },
  xhs: { w: 1242, h: 1656, tag: 'xhs' }
};

var SLIDE_TYPES = [
  { id: 'hook', label: 'Hook' },
  { id: 'content', label: 'Content' },
  { id: 'stat', label: 'Stat / Verdict' },
  { id: 'cta', label: 'CTA (per platform)' }
];

var forgeCardId = null;
var forgeSlideIdx = 0;

function forgeUid() {
  return 'sl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function ensureDeck(c) {
  if (!c.deck) {
    c.deck = {
      slides: [
        { id: forgeUid(), type: 'hook', a: '', b: '' },
        { id: forgeUid(), type: 'content', a: '', b: '' },
        { id: forgeUid(), type: 'cta', a: '', b: '', c: '', d: '' }
      ]
    };
  }
  return c.deck;
}

/* ---------------- text wrapping (CJK-aware) ---------------- */

var CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

function forgeTokens(text) {
  return text.match(/[　-〿㐀-䶿一-鿿豈-﫿＀-￯]|[^\s　-〿㐀-䶿一-鿿豈-﫿＀-￯]+|\s+/g) || [];
}

/* wrap one paragraph against ctx's current font */
function wrapPara(ctx, text, maxW) {
  var tokens = forgeTokens(text);
  var lines = [];
  var cur = '';
  tokens.forEach(function (t) {
    if (/^\s+$/.test(t)) {
      if (cur) cur += ' ';
      return;
    }
    var candidate = cur + t;
    if (ctx.measureText(candidate).width > maxW && cur) {
      lines.push(cur.replace(/\s+$/, ''));
      cur = t.replace(/^\s+/, '');
    } else {
      cur = candidate;
    }
  });
  if (cur.replace(/\s+$/, '')) lines.push(cur.replace(/\s+$/, ''));
  return lines;
}

/* wrap multi-paragraph text; returns array of lines ('' = para gap) */
function wrapText(ctx, text, maxW) {
  var out = [];
  String(text).split(/\n+/).forEach(function (para, i) {
    if (!para.trim()) return;
    if (i > 0 && out.length) out.push('');
    wrapPara(ctx, para.trim(), maxW).forEach(function (l) { out.push(l); });
  });
  return out;
}

function drawLines(ctx, lines, x, startY, lineH) {
  var y = startY;
  lines.forEach(function (l) {
    if (l === '') { y += lineH * 0.5; return; }
    ctx.fillText(l, x, y);
    y += lineH;
  });
  return y;
}

function measureBlock(lines, lineH) {
  var h = 0;
  lines.forEach(function (l) { h += (l === '') ? lineH * 0.5 : lineH; });
  return h;
}

/* ---------------- slide rendering ---------------- */

function displayFont(px, weight) {
  return (weight || 700) + ' ' + px + 'px "Zen Maru Gothic", "Noto Sans SC", sans-serif';
}
function bodyFont(px, weight) {
  return (weight || 400) + ' ' + px + 'px "Zen Kaku Gothic New", "Noto Sans SC", sans-serif';
}

/* returns {a,b} text for a slide honoring per-platform CTA fields */
function slideTexts(slide, platform) {
  if (slide.type === 'cta' && platform === 'xhs') {
    return { a: slide.c || slide.a || '', b: slide.d || slide.b || '' };
  }
  return { a: slide.a || '', b: slide.b || '' };
}

function renderSlide(canvas, slide, opts) {
  var W = canvas.width, H = canvas.height;
  var s = W / 1080; /* scale relative to IG base */
  var M = 96 * s;   /* margin */
  var maxW = W - 2 * M;
  var ctx = canvas.getContext('2d');
  var col = FORGE_COLORS;
  var accent = opts.accent || col.lantern;
  var t = slideTexts(slide, opts.platform);

  /* background */
  ctx.fillStyle = col.paper;
  ctx.fillRect(0, 0, W, H);

  /* header: banner left, slide count right */
  ctx.textBaseline = 'alphabetic';
  ctx.font = bodyFont(Math.round(30 * s), 700);
  ctx.fillStyle = col.inkSoft;
  ctx.textAlign = 'left';
  ctx.fillText((opts.banner || 'DMICO').toUpperCase(), M, M);
  ctx.textAlign = 'right';
  ctx.font = bodyFont(Math.round(30 * s), 400);
  ctx.fillStyle = col.inkFaint;
  ctx.fillText(opts.pageNum + ' / ' + opts.pageTotal, W - M, M);
  ctx.textAlign = 'left';

  /* footer accent bar */
  ctx.fillStyle = accent;
  ctx.fillRect(0, H - 18 * s, W, 18 * s);

  if (slide.type === 'hook') {
    var hookPx = Math.round(92 * s), hookLH = hookPx * 1.25;
    ctx.font = displayFont(hookPx);
    var hookLines = wrapText(ctx, t.a, maxW);
    var subPx = Math.round(42 * s), subLH = subPx * 1.5;
    ctx.font = bodyFont(subPx);
    var subLines = wrapText(ctx, t.b, maxW);
    var block = measureBlock(hookLines, hookLH) + (subLines.length ? 40 * s + measureBlock(subLines, subLH) : 0);
    var y = (H - block) / 2 + hookPx;

    ctx.font = displayFont(hookPx);
    ctx.fillStyle = col.ink;
    y = drawLines(ctx, hookLines, M, y - hookPx + hookPx, hookLH);
    /* lantern underline */
    ctx.fillStyle = accent;
    ctx.fillRect(M, y - hookLH + 18 * s, 140 * s, 10 * s);
    if (subLines.length) {
      ctx.font = bodyFont(subPx);
      ctx.fillStyle = col.inkSoft;
      drawLines(ctx, subLines, M, y + 40 * s, subLH);
    }
  } else if (slide.type === 'content') {
    var hPx = Math.round(56 * s), hLH = hPx * 1.3;
    ctx.font = displayFont(hPx);
    var hLines = wrapText(ctx, t.a, maxW);
    var bPx = Math.round(42 * s), bLH = bPx * 1.6;
    ctx.font = bodyFont(bPx);
    var bLines = wrapText(ctx, t.b, maxW);
    var blockH = measureBlock(hLines, hLH) + (bLines.length ? 30 * s + measureBlock(bLines, bLH) : 0);
    var yy = Math.max((H - blockH) / 2, 200 * s) + hPx;

    ctx.font = displayFont(hPx);
    ctx.fillStyle = col.ink;
    yy = drawLines(ctx, hLines, M, yy - hPx + hPx, hLH);
    if (bLines.length) {
      ctx.font = bodyFont(bPx);
      ctx.fillStyle = col.inkSoft;
      drawLines(ctx, bLines, M, yy + 30 * s, bLH);
    }
  } else if (slide.type === 'stat') {
    var bigPx = Math.round(150 * s), bigLH = bigPx * 1.15;
    ctx.font = displayFont(bigPx);
    var bigLines = wrapText(ctx, t.a, maxW);
    var lblPx = Math.round(46 * s), lblLH = lblPx * 1.5;
    ctx.font = bodyFont(lblPx);
    var lblLines = wrapText(ctx, t.b, maxW);
    var bh = measureBlock(bigLines, bigLH) + (lblLines.length ? 30 * s + measureBlock(lblLines, lblLH) : 0);
    var y2 = (H - bh) / 2 + bigPx;

    ctx.font = displayFont(bigPx);
    ctx.fillStyle = accent;
    y2 = drawLines(ctx, bigLines, M, y2 - bigPx + bigPx, bigLH);
    if (lblLines.length) {
      ctx.font = bodyFont(lblPx);
      ctx.fillStyle = col.ink;
      drawLines(ctx, lblLines, M, y2 + 30 * s, lblLH);
    }
  } else { /* cta */
    var cPx = Math.round(72 * s), cLH = cPx * 1.3;
    ctx.font = displayFont(cPx);
    var cLines = wrapText(ctx, t.a, maxW);
    var dPx = Math.round(42 * s), dLH = dPx * 1.5;
    ctx.font = bodyFont(dPx);
    var dLines = wrapText(ctx, t.b, maxW);
    var ch = measureBlock(cLines, cLH) + (dLines.length ? 36 * s + measureBlock(dLines, dLH) : 0);
    var y3 = (H - ch) / 2 + cPx;

    /* accent panel behind CTA */
    var padY = 70 * s;
    ctx.fillStyle = col.surface;
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 3 * s;
    roundRect(ctx, M / 2, y3 - cPx - padY, W - M, ch + padY * 2, 28 * s);
    ctx.fill();
    ctx.stroke();

    ctx.font = displayFont(cPx);
    ctx.fillStyle = col.accentDeep;
    y3 = drawLines(ctx, cLines, M, y3 - cPx + cPx, cLH);
    if (dLines.length) {
      ctx.font = bodyFont(dPx);
      ctx.fillStyle = col.inkSoft;
      drawLines(ctx, dLines, M, y3 + 36 * s, dLH);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- forge UI ---------------- */

function openForge(cardId) {
  var c = getCard(cardId);
  if (!c) return;
  forgeCardId = cardId;
  forgeSlideIdx = 0;
  ensureDeck(c);
  $('forgeCardTitle').textContent = c.title;
  renderForge();
  $('forgeBack').classList.remove('hidden');
}

function closeForge() {
  save();
  forgeCardId = null;
  $('forgeBack').classList.add('hidden');
}

function forgeCard() { return getCard(forgeCardId); }

function renderForge() {
  var c = forgeCard();
  if (!c) return;
  var slides = c.deck.slides;
  if (forgeSlideIdx >= slides.length) forgeSlideIdx = slides.length - 1;
  if (forgeSlideIdx < 0) forgeSlideIdx = 0;

  /* slide list */
  var list = $('forgeSlides');
  list.textContent = '';
  slides.forEach(function (sl, i) {
    var row = el('div', 'forge-slide-row' + (i === forgeSlideIdx ? ' active' : ''));
    var typeLabel = SLIDE_TYPES.filter(function (t) { return t.id === sl.type; })[0].label;
    var main = el('button', 'forge-slide-btn', (i + 1) + '. ' + typeLabel + (sl.a ? ': ' + sl.a.slice(0, 18) : ''));
    main.addEventListener('click', function () { forgeSlideIdx = i; renderForge(); });
    row.appendChild(main);

    var up = el('button', 'btn small', '↑');
    up.disabled = i === 0;
    up.addEventListener('click', function () { moveSlide(i, -1); });
    var down = el('button', 'btn small', '↓');
    down.disabled = i === slides.length - 1;
    down.addEventListener('click', function () { moveSlide(i, 1); });
    var del = el('button', 'btn small', '✕');
    del.addEventListener('click', function () { removeSlide(i); });
    row.appendChild(up); row.appendChild(down); row.appendChild(del);
    list.appendChild(row);
  });

  var hint = $('forgeCountHint');
  hint.textContent = slides.length + ' slides. IG sweet spot is 8 to 10.';

  renderSlideEditor();
  schedulePreview();
}

function moveSlide(i, dir) {
  var slides = forgeCard().deck.slides;
  var j = i + dir;
  if (j < 0 || j >= slides.length) return;
  var tmp = slides[i]; slides[i] = slides[j]; slides[j] = tmp;
  if (forgeSlideIdx === i) forgeSlideIdx = j;
  else if (forgeSlideIdx === j) forgeSlideIdx = i;
  save();
  renderForge();
}

function removeSlide(i) {
  var slides = forgeCard().deck.slides;
  if (slides.length <= 1) { alert('A deck needs at least one slide.'); return; }
  if (!confirm('Remove slide ' + (i + 1) + '?')) return;
  slides.splice(i, 1);
  if (forgeSlideIdx >= slides.length) forgeSlideIdx = slides.length - 1;
  save();
  renderForge();
}

function addSlide(type) {
  var slides = forgeCard().deck.slides;
  if (slides.length >= 12) { alert('12 slides max. IG cuts you off at 20 anyway, and nobody swipes that far.'); return; }
  slides.push({ id: forgeUid(), type: type, a: '', b: '', c: '', d: '' });
  forgeSlideIdx = slides.length - 1;
  save();
  renderForge();
}

var FIELD_LABELS = {
  hook: { a: 'Hook line (big)', b: 'Sub line' },
  content: { a: 'Heading', b: 'Body' },
  stat: { a: 'Big number / verdict', b: 'Label' },
  cta: { a: 'IG: CTA heading', b: 'IG: CTA sub (link in bio etc.)', c: 'XHS: CTA heading (no link talk)', d: 'XHS: CTA sub (关注 / 评论 bait)' }
};

function renderSlideEditor() {
  var c = forgeCard();
  var sl = c.deck.slides[forgeSlideIdx];
  var box = $('forgeFields');
  box.textContent = '';
  if (!sl) return;

  var labels = FIELD_LABELS[sl.type];
  Object.keys(labels).forEach(function (key) {
    var lab = el('label', null, labels[key]);
    var input = document.createElement(key === 'b' && sl.type === 'content' ? 'textarea' : 'input');
    if (input.tagName === 'INPUT') input.type = 'text';
    else input.rows = 4;
    input.value = sl[key] || '';
    input.addEventListener('input', function () {
      sl[key] = input.value;
      c.updated = Date.now();
      save();
      schedulePreview();
    });
    lab.appendChild(input);
    box.appendChild(lab);
  });
}

/* preview: debounce renders so typing stays smooth */
var previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}

function renderPreview() {
  var c = forgeCard();
  if (!c) return;
  var sl = c.deck.slides[forgeSlideIdx];
  if (!sl) return;
  var canvas = $('forgeCanvas');
  var p = getPersona(c.personaId);
  var fonts = [
    '700 92px "Zen Maru Gothic"',
    '400 42px "Zen Kaku Gothic New"'
  ];
  Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).then(function () {
    renderSlide(canvas, sl, {
      platform: 'ig',
      banner: p ? p.banner : 'DMICO',
      accent: p ? p.accent : FORGE_COLORS.lantern,
      pageNum: forgeSlideIdx + 1,
      pageTotal: c.deck.slides.length
    });
  });
}

/* ---------------- export ---------------- */

function slugify(str) {
  var slug = String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return slug || 'deck';
}

function canvasToPng(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob); else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

function exportDeck(platformKey) {
  var c = forgeCard();
  if (!c) return;
  var size = FORGE_SIZES[platformKey];
  var p = getPersona(c.personaId);
  var slug = slugify(c.title);
  var btn = platformKey === 'ig' ? $('forgeExportIg') : $('forgeExportXhs');
  var oldTxt = btn.textContent;
  btn.textContent = 'Rendering…';
  btn.disabled = true;

  var fonts = ['700 92px "Zen Maru Gothic"', '400 42px "Zen Kaku Gothic New"'];
  Promise.all(fonts.map(function (f) { return document.fonts.load(f); })).then(function () {
    var jobs = c.deck.slides.map(function (sl, i) {
      var cv = document.createElement('canvas');
      cv.width = size.w; cv.height = size.h;
      renderSlide(cv, sl, {
        platform: platformKey,
        banner: p ? p.banner : 'DMICO',
        accent: p ? p.accent : FORGE_COLORS.lantern,
        pageNum: i + 1,
        pageTotal: c.deck.slides.length
      });
      return canvasToPng(cv).then(function (blob) {
        var num = (i + 1 < 10 ? '0' : '') + (i + 1);
        return new File([blob], slug + '-' + size.tag + '-' + num + '.png', { type: 'image/png' });
      });
    });
    return Promise.all(jobs);
  }).then(function (files) {
    if (navigator.canShare && navigator.canShare({ files: files })) {
      return navigator.share({ files: files, title: c.title }).catch(function () {
        downloadFiles(files);
      });
    }
    downloadFiles(files);
  }).catch(function (e) {
    alert('Export failed: ' + e.message);
  }).then(function () {
    btn.textContent = oldTxt;
    btn.disabled = false;
  });
}

function downloadFiles(files) {
  files.forEach(function (f, i) {
    setTimeout(function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }, i * 350); /* stagger so the browser doesn't swallow downloads */
  });
}

/* ---------------- wire up ---------------- */

document.addEventListener('DOMContentLoaded', function () {
  $('forgeClose').addEventListener('click', closeForge);
  $('forgeAddBar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-addtype]');
    if (b) addSlide(b.dataset.addtype);
  });
  $('forgeExportIg').addEventListener('click', function () { exportDeck('ig'); });
  $('forgeExportXhs').addEventListener('click', function () { exportDeck('xhs'); });
});
