/* =========================================================================
   Perp Farming Guide — app
   Everything renders from /data/dexes.json. Add an entry there and the new
   DEX appears on both pages with its icon, animation, link and detail view.
   ========================================================================= */

const DATA_DEXES = '/data/dexes.json';
const DATA_SITE = '/data/site.json';

const ROUTES = {
  '/': {
    title: 'Perp Farming Guide — How to Farm Perp DEX Points | @justkennethape',
    render: renderHome,
  },
  '/perp-dex-list': {
    title: 'Perp DEX List — Perp Farming Guide',
    render: renderList,
  },
  '/points-sheet': {
    title: 'Points Sheet — Perp Farming Guide',
    render: renderPoints,
  },
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const main = document.getElementById('main');
const dexDialog = document.getElementById('dex-dialog');
const lightbox = document.getElementById('lightbox');

let dexes = [];
let site = null;
let homeHTML = main.innerHTML; // static hero, restored when we navigate back home
const focusStack = []; // where to return focus when each dialog closes

/* ------------------------------------------------------------------ utils */
const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ordered = (list) => [...list].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

const isActive = (dex) => !dex.status || dex.status === 'active';

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ARROW =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

const arrowRight =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

/* ------------------------------------------------------------ card markup */
function cardMarkup(dex, index, mode) {
  const link = mode === 'link';
  const available = isActive(dex);
  const hasSheet = Boolean(dex.hasPointsSheet && dex.pointsSheetImage);

  let chips = '';
  if (!available) {
    chips = '<span class="chip chip--soon">Coming soon</span>';
  } else if (!link) {
    chips = hasSheet
      ? '<span class="chip chip--points">Points sheet</span>'
      : '<span class="chip chip--open">Details</span>';
  }

  const label = esc(dex.name);
  const inner = `
    <span class="dex-card__logo">
      <img src="${esc(dex.logo)}" alt="${label} logo" width="76" height="76" loading="lazy" decoding="async" />
    </span>
    <span class="dex-card__name">${label}</span>
    <span class="dex-card__chips">${chips}</span>
    <span class="dex-card__go">${link ? 'Visit site' : 'Open details'} ${ARROW}</span>`;

  if (link) {
    if (!available) {
      return `<li><div class="dex-card is-soon" aria-disabled="true" style="--i:${index}">${inner}</div></li>`;
    }
    return `<li><a class="dex-card" style="--i:${index}" href="${esc(dex.referralUrl)}" target="_blank" rel="noopener noreferrer">${inner}<span class="sr-only"> — opens ${label} in a new tab</span></a></li>`;
  }

  if (!available) {
    return `<li><div class="dex-card is-soon" aria-disabled="true" style="--i:${index}">${inner}</div></li>`;
  }
  return `<li><button class="dex-card" type="button" style="--i:${index}" data-open-dex="${esc(dex.id)}" aria-haspopup="dialog">${inner}</button></li>`;
}

function gridMarkup(list, mode) {
  return `<ul class="dex-grid">${ordered(list).map((d, i) => cardMarkup(d, i, mode)).join('')}</ul>`;
}

function pageHeadMarkup({ tag, title, intro }) {
  const updated = site?.lastUpdated ? `<span>Updated <time datetime="${esc(site.lastUpdated)}">${fmtDate(site.lastUpdated)}</time></span>` : '';
  return `
    <a class="back-link" href="/" data-route><span aria-hidden="true">←</span> Home</a>
    <header class="page-head">
      <span class="page-head__tag">${esc(tag)}</span>
      <h1>${esc(title)}</h1>
      <p>${esc(intro)}</p>
      <div class="page-head__meta">
        <span>${dexes.length} venue${dexes.length === 1 ? '' : 's'} tracked</span>
        <span class="dot-sep" aria-hidden="true"></span>
        ${updated}
      </div>
    </header>`;
}

/* --------------------------------------------------------------- views */
function renderHome() {
  return homeHTML;
}

function renderList() {
  return `
    <section class="view view--list">
      <div class="container">
        ${pageHeadMarkup({
          tag: 'Page 1',
          title: 'Perp DEX List',
          intro: 'Every perp exchange I track, in one animated grid. Tap a logo to open the venue in a new tab.',
        })}
        ${gridMarkup(dexes, 'link')}
      </div>
    </section>`;
}

function renderPoints() {
  return `
    <section class="view view--points">
      <div class="container">
        ${pageHeadMarkup({
          tag: 'Page 2',
          title: 'Points Sheet',
          intro: 'Same venues, deeper detail: description, latest updates, points and rewards, funding and rival potential. Three of them also carry a zoomable points sheet.',
        })}
        ${gridMarkup(dexes, 'detail')}
      </div>
    </section>`;
}

function renderNotFound() {
  return `
    <section class="view">
      <div class="container">
        <div class="state-box">
          <h2>Page not found</h2>
          <p>That URL does not exist on this site.</p>
          <p style="margin-top:16px"><a class="btn btn--accent" href="/" data-route>Back to the guide</a></p>
        </div>
      </div>
    </section>`;
}

function renderError(message) {
  return `
    <section class="view">
      <div class="container">
        <div class="state-box">
          <h2>Could not load the DEX data</h2>
          <p>${esc(message)}</p>
          <p style="margin-top:16px">Make sure you are running the local server (not opening the file directly): run <code>npm start</code> and open <code>http://localhost:4173</code>.</p>
        </div>
      </div>
    </section>`;
}

/* --------------------------------------------------------------- routing */
function paint(html) {
  main.innerHTML = html;
  document.documentElement.classList.remove('js-boot');
  markActiveNav();
}

function transitionTo(pathname) {
  const run = () => paint(ROUTES[pathname].render());

  if (document.startViewTransition && !reducedMotion.matches) {
    document.startViewTransition(run);
  } else {
    main.classList.add('is-leaving');
    window.setTimeout(() => {
      run();
      main.classList.remove('is-leaving');
      main.classList.add('is-entering');
      window.setTimeout(() => main.classList.remove('is-entering'), 400);
    }, reducedMotion.matches ? 0 : 160);
  }
}

function navigate(pathname, { push = true } = {}) {
  const route = ROUTES[pathname];
  if (!route) {
    document.title = 'Page not found — Perp Farming Guide';
    if (push) history.pushState({}, '', pathname);
    transitionToFallback(renderNotFound);
    return;
  }

  if (push) history.pushState({}, '', pathname);
  document.title = route.title;
  transitionTo(pathname);
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.setTimeout(() => main.focus({ preventScroll: true }), 60);
}

function transitionToFallback(render) {
  if (document.startViewTransition && !reducedMotion.matches) {
    document.startViewTransition(() => paint(render()));
  } else {
    paint(render());
  }
}

function markActiveNav() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const active = el.dataset.nav === path;
    el.classList.toggle('is-active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

/* ------------------------------------------------------------- dialogs */
function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
}

function openDialog(dialog, html) {
  focusStack.push(document.activeElement);
  dialog.innerHTML = html;
  dialog.showModal();
  document.body.classList.add('dialog-open');
  const closeBtn = dialog.querySelector('[data-close]');
  if (closeBtn) closeBtn.focus();
}

function wireDialog(dialog) {
  closeOnBackdrop(dialog);
  dialog.addEventListener('close', () => {
    // Keep the page locked while any dialog is still open (nested lightbox).
    document.body.classList.toggle('dialog-open', dexDialog.open || lightbox.open);
    if (lightbox.open && dialog !== lightbox) lightbox.close();
    const prev = focusStack.pop();
    if (prev && document.contains(prev)) {
      try { prev.focus({ preventScroll: true }); } catch { /* element is inert */ }
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) dialog.close();
  });
}

function detailMarkup(dex) {
  const hasSheet = Boolean(dex.hasPointsSheet && dex.pointsSheetImage);
  const updates = (dex.latestUpdates || [])
    .map((u) => `<li>${esc(u)}</li>`)
    .join('');
  const specs = (dex.speculation || [])
    .map((s) => `<p class="callout callout--spec"><span class="spec-badge">Speculation</span><br />${esc(s)}</p>`)
    .join('');

  const sheet = hasSheet
    ? `<figure class="sheet-figure">
         <button class="sheet-zoom" type="button" data-zoom="${esc(dex.pointsSheetImage)}" aria-label="Zoom the ${esc(dex.name)} points sheet">
           <img src="${esc(dex.pointsSheetImage)}" alt="${esc(dex.pointsSheetAlt || `${dex.name} points sheet`)}" loading="lazy" decoding="async" />
           <span class="sheet-zoom__hint">Click to zoom</span>
         </button>
         <figcaption>${esc(dex.name)} points sheet — tap the image to enlarge.</figcaption>
       </figure>`
    : '';

  return `
    <div class="sheet-dialog__head">
      <span class="sheet-dialog__logo"><img src="${esc(dex.logo)}" alt="${esc(dex.name)} logo" width="52" height="52" /></span>
      <div class="sheet-dialog__titles">
        <h2 id="dex-dialog-title">${esc(dex.name)}</h2>
        <div class="sheet-dialog__sub">
          <span class="chip ${hasSheet ? 'chip--points' : 'chip--open'}">${hasSheet ? 'Points sheet' : 'Details'}</span>
          ${isActive(dex) ? '' : '<span class="chip chip--soon">Coming soon</span>'}
        </div>
      </div>
      <button class="icon-btn" type="button" data-close aria-label="Close details">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="sheet-dialog__body">
      <section class="detail-section">
        <h3>Description</h3>
        <p>${esc(dex.shortDescription)}</p>
      </section>

      ${sheet}

      <section class="detail-section">
        <h3>Latest Updates</h3>
        <ul class="updates">${updates}</ul>
      </section>

      <section class="detail-section">
        <h3>Points / Rewards</h3>
        <p>${esc(dex.pointsInfo)}</p>
        ${specs}
      </section>

      <section class="detail-section">
        <h3>Funding / Rival Potential</h3>
        <p>${esc(dex.fundingInfo)}</p>
      </section>

      <div class="sheet-dialog__foot">
        <a class="btn btn--accent" href="${esc(dex.referralUrl)}" target="_blank" rel="noopener noreferrer">
          Open ${esc(dex.name)} ${ARROW}<span class="sr-only"> (opens in a new tab)</span>
        </a>
        <small>${esc(site?.referralNote || '')}</small>
      </div>
    </div>`;
}

function lightboxMarkup(src, alt) {
  return `
    <div class="lightbox__inner">
      <div class="lightbox__bar">
        <span>${esc(alt || 'Points sheet')}</span>
        <span style="display:flex;gap:8px">
          <button class="icon-btn" type="button" data-zoom-toggle aria-label="Toggle extra zoom">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>
          </button>
          <button class="icon-btn" type="button" data-close aria-label="Close image">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </span>
      </div>
      <div class="lightbox__img-wrap">
        <img src="${esc(src)}" alt="${esc(alt || 'Points sheet, enlarged')}" data-close />
      </div>
    </div>`;
}

/* ------------------------------------------------------------ data load */
async function loadJson(url, label) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${label} could not be loaded (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${label} is not valid JSON. Check for a trailing comma or unquoted key.`);
  }
}

function applySiteConfig() {
  if (!site) return;
  const updated = site.lastUpdated ? fmtDate(site.lastUpdated) : null;
  if (updated) {
    document.querySelectorAll('#stat-updated, #footer-updated').forEach((el) => {
      el.textContent = updated;
      el.setAttribute('datetime', site.lastUpdated);
    });
  }
  if (site.referralNote) {
    const note = document.getElementById('referral-note');
    if (note) note.textContent = site.referralNote;
  }
  const count = document.getElementById('stat-count');
  if (count) count.textContent = String(dexes.length);
}

/* --------------------------------------------------------------- events */
document.addEventListener('click', (event) => {
  const routeLink = event.target.closest('a[data-route]');
  if (routeLink) {
    const url = new URL(routeLink.href, location.origin);
    if (url.origin !== location.origin) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (url.pathname === location.pathname) {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      return;
    }
    navigate(url.pathname);
    return;
  }

  const opener = event.target.closest('[data-open-dex]');
  if (opener) {
    const dex = dexes.find((d) => d.id === opener.dataset.openDex);
    if (dex) openDialog(dexDialog, detailMarkup(dex));
    return;
  }

  const zoomer = event.target.closest('[data-zoom]');
  if (zoomer) {
    const src = zoomer.dataset.zoom;
    const img = zoomer.querySelector('img');
    openDialog(lightbox, lightboxMarkup(src, img ? img.alt : 'Points sheet'));
    return;
  }

  if (event.target.closest('[data-zoom-toggle]')) {
    const wrap = lightbox.querySelector('.lightbox__img-wrap');
    if (wrap) wrap.classList.toggle('is-zoomed');
    return;
  }

  // clicking the enlarged image closes the lightbox
  if (lightbox.open && event.target.closest('.lightbox__img-wrap img')) {
    lightbox.close();
  }
});

window.addEventListener('popstate', () => {
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.title = ROUTES[path] ? ROUTES[path].title : 'Page not found — Perp Farming Guide';
  if (ROUTES[path]) transitionTo(path);
  else transitionToFallback(renderNotFound);
  markActiveNav();
});

/* ----------------------------------------------------------------- init */
async function init() {
  wireDialog(dexDialog);
  wireDialog(lightbox);

  try {
    const [dexData, siteData] = await Promise.all([
      loadJson(DATA_DEXES, 'data/dexes.json'),
      loadJson(DATA_SITE, 'data/site.json').catch(() => null),
    ]);
    dexes = Array.isArray(dexData) ? dexData : dexData.dexes || [];
    site = siteData;
  } catch (error) {
    paint(renderError(error.message));
    document.title = 'Data error — Perp Farming Guide';
    return;
  }

  applySiteConfig();

  const path = location.pathname.replace(/\/$/, '') || '/';
  if (ROUTES[path]) {
    document.title = ROUTES[path].title;
    if (path !== '/') paint(ROUTES[path].render());
    else document.documentElement.classList.remove('js-boot');
  } else {
    document.title = 'Page not found — Perp Farming Guide';
    transitionToFallback(renderNotFound);
  }
  markActiveNav();
}

init();
