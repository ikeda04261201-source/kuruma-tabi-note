/**
 * くるま旅ノート — Main Application
 */
import { onRoute, startRouter, navigate, type Route } from './router';
import { getMeta, setMeta, saveVehicle, initDefaultChecklist } from './db';
import { icons } from './icons';

const app = document.getElementById('app')!;

// Re-export for backwards compat
export { showToast } from './toast';

// ---- Navigation ----
const NAV_ITEMS: Array<{ route: Route; icon: string; label: string }> = [
  { route: 'home', icon: icons.home, label: 'ホーム' },
  { route: 'record', icon: icons.record, label: '記録' },
  { route: 'map', icon: icons.map, label: 'マップ' },
  { route: 'car', icon: icons.car, label: '車のこと' },
];

function renderNav(activeRoute: Route): string {
  return `<nav class="bottom-nav" role="navigation" aria-label="メインメニュー">
    ${NAV_ITEMS.map(item => `
      <button class="nav-item ${item.route === activeRoute ? 'active' : ''}"
              data-nav="${item.route}"
              aria-label="${item.label}"
              aria-current="${item.route === activeRoute ? 'page' : 'false'}">
        ${item.icon}
        <span>${item.label}</span>
      </button>
    `).join('')}
  </nav>`;
}

function setupNavListeners(): void {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = (btn as HTMLElement).dataset.nav as Route;
      navigate(route);
    });
  });
}

function renderPage(route: Route, content: string): void {
  const navHtml = renderNav(route);
  app.innerHTML = `
    <main class="page-content page-enter" id="page-main">
      ${content}
    </main>
    ${navHtml}
  `;
  setupNavListeners();
  window.scrollTo(0, 0);
}

function renderFullscreen(content: string): void {
  app.innerHTML = `<div class="page-fullscreen page-enter">${content}</div>`;
}

// ---- Welcome Screen ----
function renderWelcome(): void {
  renderFullscreen(`
    <div style="max-width: 360px;">
      <h1 style="margin-bottom: var(--space-lg); font-size: var(--text-2xl);">
        くるま旅ノート
      </h1>
      <p style="margin-bottom: var(--space-xl); color: var(--color-ink-light); font-family: var(--font-serif); font-size: var(--text-lg); line-height: 2;">
        ふたりの旅の思い出を<br>この手の中に残していく<br>小さなノートです
      </p>
      <button class="btn btn-primary" id="btn-start">
        はじめる
      </button>
    </div>
  `);
  document.getElementById('btn-start')!.addEventListener('click', () => {
    navigate('name-car');
  });
}

// ---- Name the Car Screen ----
function renderNameCar(): void {
  renderFullscreen(`
    <div style="max-width: 360px; width: 100%;">
      <h2 style="margin-bottom: var(--space-md);">
        あなたの車に<br>名前をつけませんか？
      </h2>
      <p style="margin-bottom: var(--space-xl); color: var(--color-ink-light); font-size: var(--text-sm);">
        愛車に名前をつけると、アプリがその名前で語りかけます。<br>あとから変えることもできます。
      </p>
      <div style="margin-bottom: var(--space-lg);">
        <input type="text" id="car-name" placeholder="例: はなちゃん号"
               style="text-align: center; font-size: var(--text-lg);">
      </div>
      <button class="btn btn-primary mb-md" id="btn-save-name">
        この名前にする
      </button>
      <button class="btn btn-ghost" id="btn-skip-name" style="width: 100%;">
        あとで決める
      </button>
    </div>
  `);

  const saveName = async (name: string) => {
    await saveVehicle(name || 'くるま');
    await setMeta('onboarded', 'true');
    await initDefaultChecklist();
    navigate('home');
  };

  document.getElementById('btn-save-name')!.addEventListener('click', async () => {
    const input = document.getElementById('car-name') as HTMLInputElement;
    await saveName(input.value.trim());
  });

  document.getElementById('btn-skip-name')!.addEventListener('click', async () => {
    await saveName('くるま');
  });
}

// ---- Route Registration ----
async function init(): Promise<void> {
  onRoute('welcome', () => renderWelcome());
  onRoute('name-car', () => renderNameCar());

  onRoute('home', async () => {
    const onboarded = await getMeta('onboarded');
    if (!onboarded) {
      navigate('welcome');
      return;
    }
    const { renderHome, setupHome } = await import('./pages/home');
    const content = await renderHome();
    renderPage('home', content);
    setupHome();
  });

  onRoute('checklist', async () => {
    const { renderChecklist, setupChecklist } = await import('./pages/checklist');
    const content = await renderChecklist();
    renderPage('home', content);
    setupChecklist();
  });

  onRoute('record', async (params) => {
    const { renderRecord, setupRecord } = await import('./pages/record');
    const content = await renderRecord(params);
    renderPage('record', content);
    setupRecord(params);
  });

  onRoute('record-edit', async (params) => {
    const { renderRecord, setupRecord } = await import('./pages/record');
    const content = await renderRecord(params);
    renderPage('record', content);
    setupRecord(params);
  });

  onRoute('map', async () => {
    const { renderMap, setupMap } = await import('./pages/map');
    const content = await renderMap();
    renderPage('map', content);
    setupMap();
  });

  onRoute('car', async () => {
    const { renderAbout, setupAbout } = await import('./pages/about');
    const content = await renderAbout();
    renderPage('car', content);
    setupAbout();
  });

  onRoute('about', async () => {
    const { renderAbout, setupAbout } = await import('./pages/about');
    const content = await renderAbout();
    renderPage('car', content);
    setupAbout();
  });

  // Start
  const isOnboarded = await getMeta('onboarded');
  if (!isOnboarded && !window.location.hash) {
    navigate('welcome');
  }
  startRouter();
}

init();
