/**
 * 車のこと & このアプリについて
 */
import { getVehicle, saveVehicle } from '../db';
import { showToast } from '../toast';
import { icons } from '../icons';

export async function renderAbout(): Promise<string> {
  const vehicle = await getVehicle();
  const carName = vehicle?.name || 'くるま';

  return `
    <h2 class="mb-lg" style="font-family: var(--font-serif);">車のこと</h2>

    <div class="card mb-lg">
      <label for="car-name-input">車の名前</label>
      <div style="display: flex; gap: var(--space-sm); align-items: center;">
        <input type="text" id="car-name-input" value="${escapeAttr(carName)}"
               style="flex: 1;">
        <button class="btn btn-secondary" id="btn-update-name" style="flex-shrink: 0;">
          変更する
        </button>
      </div>
    </div>

    <div style="border-top: 1px solid var(--color-border); padding-top: var(--space-xl); margin-top: var(--space-xl);">
      <h3 class="mb-md" style="font-family: var(--font-serif);">このアプリについて</h3>
      <div style="color: var(--color-ink-light); font-family: var(--font-serif); line-height: 2; font-size: var(--text-base);">
        <p class="mb-md">
          「くるま旅ノート」は、ふたりの旅の思い出を<br>
          この手の中に残していくための小さなアプリです。
        </p>
        <p class="mb-md">
          記録はすべてこの端末の中だけに保存されます。<br>
          インターネットに送られることはありません。
        </p>
        <p style="font-size: 14px; color: var(--color-ink-faint);">
          くるま旅ノート v1.0
        </p>
      </div>
    </div>
  `;
}

export function setupAbout(): void {
  document.getElementById('btn-update-name')?.addEventListener('click', async () => {
    const input = document.getElementById('car-name-input') as HTMLInputElement;
    const name = input.value.trim();
    if (name) {
      await saveVehicle(name);
      showToast(`${name}に変更しました`);
    }
  });
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
