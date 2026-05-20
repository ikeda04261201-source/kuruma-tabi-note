/**
 * ホーム画面
 */
import { getVehicle, getRecentMemories, type Memory } from '../db';
import { navigate } from '../router';
import { icons } from '../icons';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    '道の駅': '🚗',
    '温泉': '♨️',
    '絶景': '🏔️',
    '食事': '🍽️',
    '泊まった': '🏕️',
    'その他': '📍',
  };
  return map[cat] || '📍';
}

function memoryPhotoUrl(memory: Memory): string | null {
  if (!memory.photo) return null;
  return URL.createObjectURL(memory.photo);
}

export async function renderHome(): Promise<string> {
  const vehicle = await getVehicle();
  const carName = vehicle?.name || 'くるま';
  const recent = await getRecentMemories(2);

  const greeting = getGreeting();

  const recentHtml = recent.length > 0
    ? recent.map(m => {
        const photoUrl = memoryPhotoUrl(m);
        return `
          <button class="card mb-md" style="width: 100%; text-align: left; cursor: pointer; display: flex; gap: var(--space-sm); align-items: center; border: 1px solid var(--color-border); background: var(--color-bg-card);"
                  data-view-memory="${m.id}">
            ${photoUrl ? `<img src="${photoUrl}" class="photo-thumb-small" alt="">` : ''}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: var(--text-sm); color: var(--color-ink-faint);">
                ${formatDate(m.date)} ${categoryEmoji(m.category)} ${m.category}
              </div>
              <div style="font-size: var(--text-base); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${m.memo || m.prefecture || 'ひとことなし'}
              </div>
            </div>
            <span style="color: var(--color-ink-faint);">${icons.chevronRight}</span>
          </button>
        `;
      }).join('')
    : `<div class="empty-state">
        <p>まだ記録はありません。<br>次のお出かけが楽しみですね</p>
       </div>`;

  return `
    <div style="text-align: center; margin-bottom: var(--space-xl); padding-top: var(--space-lg);">
      <h1 style="font-size: var(--text-xl); margin-bottom: var(--space-xs);">
        ${greeting}
      </h1>
      <p style="color: var(--color-ink-light); font-family: var(--font-serif);">
        ${carName}、今日はどこへ行きますか？
      </p>
    </div>

    <div style="display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-xl);">
      <button class="btn btn-large btn-secondary" id="btn-checklist">
        ${icons.check}
        出発前のしたく
      </button>
      <button class="btn btn-large btn-primary" id="btn-record-now">
        ${icons.mapPin}
        今ここを記録する
      </button>
    </div>

    ${recent.length > 0 ? `<h3 class="section-heading">最近の記録</h3>` : ''}
    ${recentHtml}
  `;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'おはようございます';
  if (hour < 17) return 'こんにちは';
  return 'こんばんは';
}

export function setupHome(): void {
  document.getElementById('btn-checklist')?.addEventListener('click', () => {
    navigate('checklist');
  });

  document.getElementById('btn-record-now')?.addEventListener('click', () => {
    navigate('record');
  });

  document.querySelectorAll('[data-view-memory]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.viewMemory;
      navigate('record-edit', { id: id! });
    });
  });
}
