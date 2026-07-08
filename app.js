/* ============================================================
   DMICOckpit P1 — persona layer + pipeline board
   Data: localStorage only. Backup = JSON export/import.
   No frameworks, no network calls, no analytics.
   ============================================================ */
'use strict';

var STORE_KEY = 'dmicockpit_v1';
var BACKUP_NAG_DAYS = 14;
var TIER_B_NUDGE_DAYS = 7;
var RATIO_WINDOW = 10; /* last N posted cards for the 80/20 meter */

var STAGES = [
  { id: 'idea',    label: 'Ideas' },
  { id: 'drafted', label: 'Drafted' },
  { id: 'assets',  label: 'Assets ready' },
  { id: 'posted',  label: 'Posted' }
];

/* ---------------- state ---------------- */

var state = null;
var editingCardId = null;
var editingPersonaId = null;

function defaultState() {
  return {
    v: 1,
    personas: [
      { id: uid(), name: 'Vibe Coding / AI', handle: '', banner: 'DMICO', tier: 'A', xhs: true,  ig: true,  accent: '#e8a13c' },
      { id: uid(), name: 'Game Dev',         handle: '', banner: 'DMICO', tier: 'B', xhs: false, ig: true,  accent: '#4caf7d' },
      { id: uid(), name: 'Life / Creatives', handle: '', banner: 'DMICO', tier: 'C', xhs: true,  ig: true,  accent: '#7d8fe0' }
    ],
    cards: [],
    settings: { lastBackup: null, activePersona: 'all' }
  };
}

function load() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) { state = defaultState(); save(); return; }
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.personas)) throw new Error('bad shape');
    state = parsed;
  } catch (e) {
    console.warn('State load failed, starting fresh', e);
    state = defaultState();
    save();
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- helpers ---------------- */

function $(id) { return document.getElementById(id); }

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function getPersona(id) {
  for (var i = 0; i < state.personas.length; i++) {
    if (state.personas[i].id === id) return state.personas[i];
  }
  return null;
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function cardPostedTs(c) {
  var a = c.postedIG || 0, b = c.postedXHS || 0;
  var m = Math.max(a, b);
  return m > 0 ? m : null;
}

function isPosted(c) { return cardPostedTs(c) !== null; }

function cardStage(c) {
  if (isPosted(c)) return 'posted';
  return c.stage; /* idea | drafted | assets */
}

/* ISO week key like "2026-W28" */
function isoWeekKey(ts) {
  var d = new Date(ts);
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
}

/* consecutive weeks (ending this week or last week) with >=1 post */
function weeklyStreak(personaId) {
  var weeks = {};
  state.cards.forEach(function (c) {
    if (c.personaId !== personaId) return;
    var ts = cardPostedTs(c);
    if (ts) weeks[isoWeekKey(ts)] = true;
  });
  var streak = 0;
  var cursor = Date.now();
  /* grace: if nothing this week yet, streak counts from last week */
  if (!weeks[isoWeekKey(cursor)]) cursor -= 7 * 86400000;
  while (weeks[isoWeekKey(cursor)]) {
    streak++;
    cursor -= 7 * 86400000;
  }
  return streak;
}

/* % value posts among last RATIO_WINDOW posted cards */
function valueRatio(personaId) {
  var posted = state.cards
    .filter(function (c) { return c.personaId === personaId && isPosted(c); })
    .sort(function (a, b) { return cardPostedTs(b) - cardPostedTs(a); })
    .slice(0, RATIO_WINDOW);
  if (posted.length === 0) return null;
  var v = posted.filter(function (c) { return c.type === 'value'; }).length;
  return Math.round((v / posted.length) * 100);
}

function lastPostDays(personaId) {
  var latest = 0;
  state.cards.forEach(function (c) {
    if (c.personaId !== personaId) return;
    var ts = cardPostedTs(c);
    if (ts && ts > latest) latest = ts;
  });
  return latest ? daysSince(latest) : null;
}

/* ---------------- render: persona bar ---------------- */

function renderPersonaBar() {
  var bar = $('personaBar');
  bar.textContent = '';

  var chips = [{ id: 'all', name: 'All', accent: 'var(--muted)' }].concat(state.personas);
  chips.forEach(function (p) {
    var chip = el('button', 'persona-chip' + (state.settings.activePersona === p.id ? ' active' : ''));
    chip.style.setProperty('--chip', p.accent);
    chip.appendChild(el('span', 'dot'));
    chip.appendChild(el('span', null, p.name));
    chip.addEventListener('click', function () {
      state.settings.activePersona = p.id;
      save();
      renderBoardView();
    });
    bar.appendChild(chip);
  });
}

/* ---------------- render: dashboard strip ---------------- */

function renderDash() {
  var strip = $('dashStrip');
  strip.textContent = '';
  var active = state.settings.activePersona;

  /* which persona's metrics to show: selected persona, or tier A when "All" */
  var p = null;
  if (active === 'all') {
    p = state.personas.filter(function (x) { return x.tier === 'A'; })[0] || null;
  } else {
    p = getPersona(active);
  }
  if (!p) return;

  if (p.tier === 'C') {
    var note = el('div', 'dash-note', p.name + ' is tier C: no metrics, no guilt. Post when you feel like it.');
    strip.appendChild(note);
    return;
  }

  var last = lastPostDays(p.id);
  var lastCard = el('div', 'dash-card' + (last !== null && last > TIER_B_NUDGE_DAYS ? ' warn' : ''));
  lastCard.appendChild(el('div', 'big', last === null ? '—' : last + 'd'));
  lastCard.appendChild(el('div', 'lbl', 'since last post'));
  strip.appendChild(lastCard);

  if (p.tier === 'A') {
    var streak = weeklyStreak(p.id);
    var sCard = el('div', 'dash-card' + (streak > 0 ? ' good' : ''));
    sCard.appendChild(el('div', 'big', streak + 'w'));
    sCard.appendChild(el('div', 'lbl', 'weekly streak'));
    strip.appendChild(sCard);

    var ratio = valueRatio(p.id);
    var rCard = el('div', 'dash-card' + (ratio === null ? '' : (ratio >= 80 ? ' good' : ' bad')));
    rCard.appendChild(el('div', 'big', ratio === null ? '—' : ratio + '%'));
    rCard.appendChild(el('div', 'lbl', 'value posts (target 80%)'));
    strip.appendChild(rCard);
  }

  if (p.tier === 'B' && last !== null && last > TIER_B_NUDGE_DAYS) {
    strip.appendChild(el('div', 'dash-note', p.name + ': over a week quiet. One low-effort post keeps it alive.'));
  }
}

/* ---------------- render: board ---------------- */

function renderBoard() {
  var board = $('board');
  board.textContent = '';
  var active = state.settings.activePersona;

  var cards = state.cards.filter(function (c) {
    return active === 'all' || c.personaId === active;
  });

  STAGES.forEach(function (stage) {
    var inStage = cards
      .filter(function (c) { return cardStage(c) === stage.id; })
      .sort(function (a, b) { return b.updated - a.updated; });

    var group = el('div', 'stage-group');
    var head = el('div', 'stage-head');
    head.appendChild(el('span', null, stage.label));
    head.appendChild(el('span', 'stage-count', String(inStage.length)));
    group.appendChild(head);

    if (inStage.length === 0) {
      group.appendChild(el('p', 'hint', stage.id === 'idea' ? 'Empty. Tap "+ New idea".' : '—'));
    }

    inStage.forEach(function (c) { group.appendChild(renderCard(c)); });
    board.appendChild(group);
  });
}

function renderCard(c) {
  var p = getPersona(c.personaId);
  var node = el('div', 'card');
  node.style.setProperty('--chip', p ? p.accent : 'var(--accent)');

  var top = el('div', 'card-top');
  var title = el('div', 'card-title', c.title);
  title.addEventListener('click', function () { openCardModal(c.id); });
  top.appendChild(title);
  top.appendChild(el('span', 'badge ' + c.type, c.type));
  node.appendChild(top);

  var metaBits = [];
  if (p) metaBits.push(p.name);
  if (c.postedIG) metaBits.push('IG ✓');
  if (c.postedXHS) metaBits.push('XHS ✓');
  node.appendChild(el('div', 'card-meta', metaBits.join(' · ')));

  var actions = el('div', 'card-actions');
  var stage = cardStage(c);

  if (stage === 'idea' || stage === 'drafted') {
    var nextId = stage === 'idea' ? 'drafted' : 'assets';
    var nextLbl = stage === 'idea' ? 'Mark drafted' : 'Assets ready';
    var advance = el('button', 'btn small', nextLbl + ' →');
    advance.addEventListener('click', function () {
      c.stage = nextId; c.updated = Date.now(); save(); renderBoardView();
    });
    actions.appendChild(advance);
  }

  if (stage === 'assets' || stage === 'posted') {
    if (p && p.ig) actions.appendChild(postedToggle(c, 'postedIG', 'IG'));
    if (p && p.xhs) actions.appendChild(postedToggle(c, 'postedXHS', 'XHS'));
  }

  node.appendChild(actions);
  return node;
}

function postedToggle(c, field, label) {
  var on = !!c[field];
  var b = el('button', 'btn small' + (on ? ' toggled' : ''), on ? label + ' posted ✓' : 'Posted on ' + label + '?');
  b.addEventListener('click', function () {
    c[field] = on ? null : Date.now();
    c.updated = Date.now();
    save();
    renderBoardView();
  });
  return b;
}

/* ---------------- card modal ---------------- */

function openCardModal(cardId) {
  editingCardId = cardId || null;
  var c = cardId ? state.cards.filter(function (x) { return x.id === cardId; })[0] : null;

  $('modalTitle').textContent = c ? 'Edit card' : 'New idea';
  $('cardTitle').value = c ? c.title : '';
  $('cardType').value = c ? c.type : 'value';
  $('cardNotes').value = c ? c.notes : '';
  $('modalDelete').classList.toggle('hidden', !c);

  var sel = $('cardPersona');
  sel.textContent = '';
  state.personas.forEach(function (p) {
    var o = el('option', null, p.name);
    o.value = p.id;
    sel.appendChild(o);
  });
  if (c) sel.value = c.personaId;
  else if (state.settings.activePersona !== 'all') sel.value = state.settings.activePersona;

  $('modalBack').classList.remove('hidden');
}

function closeCardModal() {
  $('modalBack').classList.add('hidden');
  editingCardId = null;
}

function saveCardModal() {
  var title = $('cardTitle').value.trim();
  if (!title) { $('cardTitle').focus(); return; }
  var personaId = $('cardPersona').value;
  var type = $('cardType').value;
  var notes = $('cardNotes').value;

  if (editingCardId) {
    var c = state.cards.filter(function (x) { return x.id === editingCardId; })[0];
    if (c) {
      c.title = title; c.personaId = personaId; c.type = type; c.notes = notes;
      c.updated = Date.now();
    }
  } else {
    state.cards.push({
      id: uid(), personaId: personaId, title: title, type: type, notes: notes,
      stage: 'idea', postedIG: null, postedXHS: null,
      created: Date.now(), updated: Date.now()
    });
  }
  save();
  closeCardModal();
  renderBoardView();
}

function deleteCardModal() {
  if (!editingCardId) return;
  if (!confirm('Delete this card? No undo.')) return;
  state.cards = state.cards.filter(function (x) { return x.id !== editingCardId; });
  save();
  closeCardModal();
  renderBoardView();
}

/* ---------------- persona modal ---------------- */

function openPersonaModal(personaId) {
  editingPersonaId = personaId || null;
  var p = personaId ? getPersona(personaId) : null;

  $('pModalTitle').textContent = p ? 'Edit persona' : 'New persona';
  $('pName').value = p ? p.name : '';
  $('pHandle').value = p ? p.handle : '';
  $('pBanner').value = p ? p.banner : 'DMICO';
  $('pTier').value = p ? p.tier : 'C';
  $('pXhs').checked = p ? p.xhs : true;
  $('pIg').checked = p ? p.ig : true;
  $('pAccent').value = p ? p.accent : '#e8a13c';
  $('pModalDelete').classList.toggle('hidden', !p);

  $('pModalBack').classList.remove('hidden');
}

function closePersonaModal() {
  $('pModalBack').classList.add('hidden');
  editingPersonaId = null;
}

function savePersonaModal() {
  var name = $('pName').value.trim();
  if (!name) { $('pName').focus(); return; }
  var fields = {
    name: name,
    handle: $('pHandle').value.trim(),
    banner: $('pBanner').value.trim() || 'DMICO',
    tier: $('pTier').value,
    xhs: $('pXhs').checked,
    ig: $('pIg').checked,
    accent: $('pAccent').value
  };

  if (editingPersonaId) {
    var p = getPersona(editingPersonaId);
    if (p) Object.keys(fields).forEach(function (k) { p[k] = fields[k]; });
  } else {
    fields.id = uid();
    state.personas.push(fields);
  }
  save();
  closePersonaModal();
  renderAll();
}

function deletePersonaModal() {
  if (!editingPersonaId) return;
  var hasCards = state.cards.some(function (c) { return c.personaId === editingPersonaId; });
  if (hasCards) {
    alert('This persona still has cards on the board. Delete or reassign those cards first.');
    return;
  }
  if (state.personas.length <= 1) {
    alert('At least one persona must exist.');
    return;
  }
  if (!confirm('Delete this persona? No undo.')) return;
  state.personas = state.personas.filter(function (p) { return p.id !== editingPersonaId; });
  if (state.settings.activePersona === editingPersonaId) state.settings.activePersona = 'all';
  save();
  closePersonaModal();
  renderAll();
}

/* ---------------- settings ---------------- */

function renderSettings() {
  var list = $('personaList');
  list.textContent = '';
  state.personas.forEach(function (p) {
    var item = el('div', 'p-item');
    var dot = el('span', 'dot');
    dot.style.setProperty('--chip', p.accent);
    item.appendChild(dot);

    var txt = el('div');
    txt.appendChild(el('div', 'p-name', p.name));
    var plats = [p.xhs ? 'XHS' : null, p.ig ? 'IG' : null].filter(Boolean).join(' + ') || 'no platforms';
    txt.appendChild(el('div', 'p-sub', (p.handle || 'no handle') + ' · ' + plats + ' · ' + p.banner));
    item.appendChild(txt);

    item.appendChild(el('span', 'tier-tag', 'Tier ' + p.tier));
    item.addEventListener('click', function () { openPersonaModal(p.id); });
    list.appendChild(item);
  });

  var lb = state.settings.lastBackup;
  $('lastBackupInfo').textContent = lb
    ? 'Last backup: ' + new Date(lb).toLocaleDateString() + ' (' + daysSince(lb) + ' days ago).'
    : 'Never backed up. Do it now, future-you says thanks.';
}

/* ---------------- backup ---------------- */

function exportBackup() {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  var d = new Date();
  var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  a.href = URL.createObjectURL(blob);
  a.download = 'dmicockpit-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  state.settings.lastBackup = Date.now();
  save();
  renderAll();
}

function importBackup(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(reader.result);
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.personas) || !Array.isArray(parsed.cards)) {
        throw new Error('Not a DMICOckpit v1 backup');
      }
      if (!confirm('Replace ALL current data with this backup? No undo.')) return;
      state = parsed;
      save();
      renderAll();
      alert('Backup imported.');
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function renderBackupNag() {
  var nag = $('backupNag');
  var lb = state.settings.lastBackup;
  var overdue = state.cards.length > 0 && (!lb || daysSince(lb) > BACKUP_NAG_DAYS);
  nag.classList.toggle('hidden', !overdue);
  if (overdue) {
    $('backupNagText').textContent = lb
      ? 'Backup is ' + daysSince(lb) + ' days old.'
      : 'No backup yet and you have cards.';
  }
}

/* ---------------- views ---------------- */

function switchView(view) {
  $('view-board').classList.toggle('hidden', view !== 'board');
  $('view-settings').classList.toggle('hidden', view !== 'settings');
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.view === view);
  }
}

function renderBoardView() {
  renderPersonaBar();
  renderDash();
  renderBoard();
  renderBackupNag();
}

function renderAll() {
  renderBoardView();
  renderSettings();
}

/* ---------------- wire up ---------------- */

function init() {
  load();

  $('tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (t) switchView(t.dataset.view);
  });

  $('addCardBtn').addEventListener('click', function () { openCardModal(null); });
  $('modalSave').addEventListener('click', saveCardModal);
  $('modalCancel').addEventListener('click', closeCardModal);
  $('modalDelete').addEventListener('click', deleteCardModal);
  $('modalBack').addEventListener('click', function (e) { if (e.target === $('modalBack')) closeCardModal(); });

  $('addPersonaBtn').addEventListener('click', function () { openPersonaModal(null); });
  $('pModalSave').addEventListener('click', savePersonaModal);
  $('pModalCancel').addEventListener('click', closePersonaModal);
  $('pModalDelete').addEventListener('click', deletePersonaModal);
  $('pModalBack').addEventListener('click', function (e) { if (e.target === $('pModalBack')) closePersonaModal(); });

  $('exportBtn').addEventListener('click', exportBackup);
  $('nagBackupBtn').addEventListener('click', exportBackup);
  $('importFile').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
