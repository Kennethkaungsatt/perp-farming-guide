/* Perp Farming Guide — local admin helper.
   Edits data/dexes.json through the dev server; falls back to file downloads
   when no write endpoint exists (i.e. on a deployed static host). */

const $ = (s) => document.querySelector(s);

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lines = (v) =>
  String(v || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

let dexes = [];
let pass = '';
let mode = 'unknown'; // 'local' | 'static' | 'unknown' (locked)
let editing = null; // index being edited, or null for "new"
let pending = { logo: null, sheet: null }; // { file, path, url }

/* ------------------------------------------------------------------ gate */
const gate = $('#gate');
const editor = $('#editor');
const gateForm = $('#gate-form');
const gateError = $('#gate-error');
const form = $('#form');
const F = form.elements; // never use form.name / form.id — they clash with built-ins
const listEl = $('#list');

function show(el, on = true) {
  el.hidden = !on;
}

function fail(el, msg) {
  el.textContent = msg;
  show(el, true);
}

function flash(sel, msg, ms = 5000) {
  const el = $(sel);
  el.textContent = msg;
  show(el, true);
  setTimeout(() => show(el, false), ms);
}

function setMode() {
  const chip = $('#mode-chip');
  if (mode === 'local') {
    chip.textContent = 'writable · saves to disk';
    chip.className = 'chip chip--points';
  } else if (mode === 'static') {
    chip.textContent = 'static host · download mode';
    chip.className = 'chip chip--soon';
  } else {
    chip.textContent = 'locked';
    chip.className = 'chip chip--open';
  }
}

/* Deep links: /admin/#new opens the new-DEX form after unlocking. */
function honourHash() {
  if (location.hash === '#new') openForm(null);
}
window.addEventListener('hashchange', honourHash);

async function fetchDexes() {
  try {
    const data = await fetch('/data/dexes.json').then((r) => r.json());
    return Array.isArray(data) ? data : data.dexes || [];
  } catch {
    return null;
  }
}

async function probeAndUnlock(password, current) {
  try {
    const res = await fetch('/api/dexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pass': password },
      body: JSON.stringify({ pass: password, dexes: current || [] }),
    });
    const json = await res.json();
    if (res.status === 401) return { ok: false, reason: json.error || 'Wrong passphrase.' };
    if (res.ok && json.ok) return { ok: true, mode: 'local' };
    return { ok: true, mode: 'static' };
  } catch {
    return { ok: true, mode: 'static' }; // no write endpoint (deployed static host)
  }
}

gateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  show(gateError, false);
  const password = $('#pass').value;
  const current = await fetchDexes();
  if (current === null) {
    fail(gateError, 'Could not read data/dexes.json — start the local server with npm start.');
    return;
  }
  const result = await probeAndUnlock(password, current);
  if (!result.ok) {
    fail(gateError, result.reason);
    return;
  }
  dexes = current;
  pass = password;
  mode = result.mode;
  try {
    sessionStorage.setItem('admin-pass', password);
  } catch {}
  setMode();
  show(gate, false);
  show(editor, true);
  renderList();
  $('#main').focus({ preventScroll: true });
  honourHash();
});

/* ------------------------------------------------------------------ list */
function chipFor(d) {
  if (d.status && d.status !== 'active') return '<span class="chip chip--soon">coming soon</span>';
  if (d.hasPointsSheet && d.pointsSheetImage) return '<span class="chip chip--points">points sheet</span>';
  return '<span class="chip chip--open">details</span>';
}

function renderList() {
  $('#list-count').textContent = `(${dexes.length})`;
  if (!dexes.length) {
    listEl.innerHTML = '<li class="admin-empty">No DEXs yet — hit “+ New DEX”.</li>';
    return;
  }
  listEl.innerHTML = [...dexes]
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.displayOrder ?? 0) - (b.d.displayOrder ?? 0))
    .map(
      ({ d, i }) => `
      <li class="admin-list__item">
        <span class="admin-order">${esc(d.displayOrder ?? '—')}</span>
        <img class="thumb" src="${esc(d.logo)}" alt="" width="40" height="40" />
        <span class="admin-name">
          <strong>${esc(d.name)}</strong>
          <span class="admin-meta">${esc(d.id)} · ${esc(d.referralUrl || '')}</span>
        </span>
        ${chipFor(d)}
        <span class="admin-row-actions">
          <button class="btn btn--ghost btn--sm" type="button" data-edit="${i}">Edit</button>
          <button class="btn btn--ghost btn--sm" type="button" data-del="${i}" aria-label="Delete ${esc(d.name)}">✕</button>
        </span>
      </li>`
    )
    .join('');
}

listEl.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  if (edit) return openForm(Number(edit.dataset.edit));

  const del = event.target.closest('[data-del]');
  if (!del) return;
  const i = Number(del.dataset.del);
  if (confirm(`Delete ${dexes[i].name}? This is only applied once you press Save.`)) {
    dexes.splice(i, 1);
    renderList();
    if (editing === i) closeForm();
  }
});

/* ------------------------------------------------------------------ form */
function openForm(index = null) {
  editing = index;
  const d = index === null ? null : dexes[index];
  form.reset();
  show($('#form-error'), false);
  show(form, true);
  $('#form-title').textContent = d ? `Edit ${d.name}` : 'New DEX';
  $('#btn-delete').hidden = !d;

  F.name.value = d?.name || '';
  F.id.value = d?.id || '';
  F.referralUrl.value = d?.referralUrl || '';
  F.status.value = d?.status === 'coming soon' ? 'coming soon' : 'active';
  F.shortDescription.value = d?.shortDescription || '';
  F.latestUpdates.value = (d?.latestUpdates || []).join('\n');
  F.pointsInfo.value = d?.pointsInfo || '';
  F.fundingInfo.value = d?.fundingInfo || '';
  F.speculation.value = (d?.speculation || []).join('\n');
  F.displayOrder.value = d?.displayOrder ?? dexes.length + 1;
  F.logo.value = d?.logo || '';
  $('#has-sheet').checked = Boolean(d?.hasPointsSheet);
  F.pointsSheetImage.value = d?.pointsSheetImage || '';
  $('#sheet-alt').value = d?.pointsSheetAlt || '';

  pending = { logo: null, sheet: null };
  ['logo', 'sheet'].forEach((k) => {
    $(`#${k}-note`).textContent = '';
    $(`#${k}-upload`).hidden = true;
  });
  syncSheetBlock();
  updatePreviews();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  F.name.focus();
}

function closeForm() {
  editing = null;
  show(form, false);
}

$('#btn-new').addEventListener('click', () => openForm(null));
$('#btn-cancel').addEventListener('click', closeForm);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const err = $('#form-error');
  show(err, false);

  const id = F.id.value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(id)) return fail(err, 'ID must contain only lowercase letters, numbers or dashes.');

  const clash = dexes.findIndex((d, i) => d.id === id && i !== editing);
  if (clash !== -1) return fail(err, `Another entry already uses the id “${id}”.`);

  const hasSheet = $('#has-sheet').checked;
  const sheetPath = F.pointsSheetImage.value.trim();

  const entry = {
    id,
    name: F.name.value.trim(),
    logo: F.logo.value.trim(),
    referralUrl: F.referralUrl.value.trim(),
    status: F.status.value,
    shortDescription: F.shortDescription.value.trim(),
    latestUpdates: lines(F.latestUpdates.value),
    pointsInfo: F.pointsInfo.value.trim(),
    fundingInfo: F.fundingInfo.value.trim(),
    ...(lines(F.speculation.value).length ? { speculation: lines(F.speculation.value) } : {}),
    hasPointsSheet: hasSheet,
    pointsSheetImage: hasSheet && sheetPath ? sheetPath : null,
    pointsSheetAlt: hasSheet && sheetPath ? $('#sheet-alt').value.trim() || `${F.name.value.trim()} points sheet` : null,
    displayOrder: Number(F.displayOrder.value) || dexes.length + 1,
  };

  const required = [
    ['name', 'Name'],
    ['logo', 'Logo path'],
    ['referralUrl', 'Referral URL'],
    ['shortDescription', 'Short description'],
    ['pointsInfo', 'Points / Rewards'],
    ['fundingInfo', 'Funding / Rival potential'],
  ];
  for (const [key, label] of required) if (!entry[key]) return fail(err, `${label} is required.`);
  if (hasSheet && !entry.pointsSheetImage) return fail(err, 'Untick the points-sheet box or provide an image path.');

  if (editing === null) dexes.push(entry);
  else dexes[editing] = entry;

  renderList();
  closeForm();
  flash('#save-ok', `“${entry.name}” added to the list — press Save to write the file.`);
});

$('#btn-delete').addEventListener('click', () => {
  if (editing === null) return;
  if (confirm(`Delete ${dexes[editing].name}?`)) {
    dexes.splice(editing, 1);
    renderList();
    closeForm();
  }
});

/* --------------------------------------------------------------- uploads */
function syncSheetBlock() {
  show($('#sheet-block'), $('#has-sheet').checked);
}
$('#has-sheet').addEventListener('change', syncSheetBlock);

function extOf(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'png';
  return ext === 'jpeg' ? 'jpg' : ext;
}

function targetPath(kind, id, file) {
  const slug = (id || 'dex').replace(/[^a-z0-9-]/g, '');
  return kind === 'logo'
    ? `/assets/logos/${slug}.${extOf(file)}`
    : `/assets/points-sheets/${slug}-points-sheet.${extOf(file)}`;
}

function updatePreviews() {
  const logo = $('#logo-preview');
  const logoSrc = pending.logo?.url || F.logo.value;
  logo.hidden = !logoSrc;
  if (logoSrc) logo.src = logoSrc;

  const sheet = $('#sheet-preview');
  const sheetSrc = pending.sheet?.url || F.pointsSheetImage.value;
  sheet.hidden = !sheetSrc;
  if (sheetSrc) sheet.src = sheetSrc;
}

F.logo.addEventListener('input', updatePreviews);
F.pointsSheetImage.addEventListener('input', updatePreviews);

function downloadFile(name, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function wireUpload(kind) {
  const isLogo = kind === 'logo';
  const fileInput = $(`#${kind}-file`);
  const uploadBtn = $(`#${kind}-upload`);
  const note = $(`#${kind}-note`);
  const pathInput = $(isLogo ? '#logo-path' : '#sheet-path');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const path = targetPath(kind, F.id.value.trim().toLowerCase(), file);
    pending[kind] = { file, path, url: URL.createObjectURL(file) };
    pathInput.value = path;
    uploadBtn.hidden = mode !== 'local';
    note.textContent =
      mode === 'local'
        ? `saved as ${path}`
        : `static host — place the file at ${path.replace(/^\//, '')}`;
    updatePreviews();
  });

  uploadBtn.addEventListener('click', async () => {
    const item = pending[kind];
    if (!item) return;
    const dataUrl = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(item.file);
    });
    try {
      const res = await fetch('/api/asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({
          pass,
          dir: isLogo ? 'logos' : 'sheets',
          name: item.path.split('/').pop(),
          data: dataUrl,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'upload failed');
      pathInput.value = json.path;
      flash('#save-ok', `Image written to ${json.path}`);
    } catch (error) {
      downloadFile(item.path.split('/').pop(), item.file);
      fail(
        $('#save-error'),
        `Could not write the image (${error.message}) — downloaded it as ${item.path.split('/').pop()}; move it to ${item.path}`
      );
    }
  });
}

wireUpload('logo');
wireUpload('sheet');

/* ----------------------------------------------------------------- save */
const asJson = () => JSON.stringify({ dexes }, null, 2) + '\n';

$('#btn-download').addEventListener('click', () => downloadFile('dexes.json', asJson()));

$('#btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(asJson());
    flash('#save-ok', 'JSON copied to the clipboard.');
  } catch {
    fail('#save-error', 'Clipboard blocked by the browser — use Download instead.');
  }
});

$('#btn-save').addEventListener('click', async () => {
  show($('#save-error'), false);
  if (mode === 'static') {
    downloadFile('dexes.json', asJson());
    flash('#save-ok', 'Downloaded dexes.json — replace data/dexes.json with it.');
    return;
  }
  try {
    const res = await fetch('/api/dexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
      body: JSON.stringify({ pass, dexes }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'save failed');
    flash('#save-ok', `Saved ${json.count} entries to data/dexes.json — refresh the site to see them.`);
  } catch (error) {
    fail('#save-error', `Save failed: ${error.message}. Use Download instead.`);
  }
});

/* ----------------------------------------------------------------- boot */
(async function boot() {
  let saved = '';
  try {
    saved = sessionStorage.getItem('admin-pass') || '';
  } catch {}

  const current = await fetchDexes();
  if (current === null) {
    fail(gateError, 'Could not read data/dexes.json — start the local server with npm start.');
    show(gateError, true);
    return;
  }
  dexes = current;

  if (saved) {
    const result = await probeAndUnlock(saved, current);
    if (result.ok) {
      pass = saved;
      mode = result.mode;
      setMode();
      show(gate, false);
      show(editor, true);
      renderList();
      honourHash();
      return;
    }
    try {
      sessionStorage.removeItem('admin-pass');
    } catch {}
  }
  setMode();
  renderList();
})();
