/**
 * 出発前のしたく（チェックリスト）
 */
import {
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  resetChecklist,
  type ChecklistItem,
} from '../db';
import { showToast } from '../toast';
import { icons } from '../icons';

export async function renderChecklist(): Promise<string> {
  const items = await getChecklist();
  const allChecked = items.length > 0 && items.every(i => i.checked);

  const itemsHtml = items.map(item => `
    <div class="checklist-item ${item.checked ? 'checked' : ''}" data-item-id="${item.id}">
      <input type="checkbox" id="check-${item.id}" ${item.checked ? 'checked' : ''}
             data-check-id="${item.id}" aria-label="${item.text}">
      <label for="check-${item.id}" style="flex: 1; cursor: pointer; font-size: var(--text-base);">
        ${item.text}
      </label>
      <button class="btn btn-ghost" data-delete-id="${item.id}"
              aria-label="${item.text}を削除" style="padding: var(--space-xs); min-height: 40px; color: var(--color-ink-faint);">
        ${icons.trash}
      </button>
    </div>
  `).join('');

  return `
    <h2 class="mb-lg" style="font-family: var(--font-serif);">出発前のしたく</h2>

    ${allChecked ? `
      <div style="text-align: center; padding: var(--space-lg); background: var(--color-success-bg); border-radius: var(--radius-md); margin-bottom: var(--space-lg);">
        <p style="font-size: var(--text-lg); color: var(--color-success); font-family: var(--font-serif);">
          準備OK。いってらっしゃい
        </p>
      </div>
    ` : ''}

    <div id="checklist-items">
      ${itemsHtml}
    </div>

    <div style="margin-top: var(--space-lg); display: flex; gap: var(--space-sm);">
      <input type="text" id="new-item-text" placeholder="持ち物を追加する"
             style="flex: 1;">
      <button class="btn btn-secondary" id="btn-add-item" aria-label="追加"
              style="min-width: var(--tap-min);">
        ${icons.plus}
      </button>
    </div>

    <div style="margin-top: var(--space-xl); text-align: center;">
      <button class="btn btn-ghost" id="btn-reset-checklist">
        ${icons.refresh}
        チェックをリセットする
      </button>
    </div>
  `;
}

export function setupChecklist(): void {
  // Toggle check
  document.querySelectorAll('[data-check-id]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const id = Number(input.dataset.checkId);
      const items = await getChecklist();
      const item = items.find(i => i.id === id);
      if (item) {
        item.checked = input.checked;
        await updateChecklistItem(item);
        // Re-render to show completion message
        const content = await renderChecklist();
        document.getElementById('page-main')!.innerHTML = content;
        setupChecklist();
      }
    });
  });

  // Delete item
  document.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number((btn as HTMLElement).dataset.deleteId);
      await deleteChecklistItem(id);
      const content = await renderChecklist();
      document.getElementById('page-main')!.innerHTML = content;
      setupChecklist();
    });
  });

  // Add item
  const addBtn = document.getElementById('btn-add-item');
  const addInput = document.getElementById('new-item-text') as HTMLInputElement;

  const addItem = async () => {
    const text = addInput?.value.trim();
    if (!text) return;
    const items = await getChecklist();
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0;
    await addChecklistItem(text, maxOrder);
    const content = await renderChecklist();
    document.getElementById('page-main')!.innerHTML = content;
    setupChecklist();
  };

  addBtn?.addEventListener('click', addItem);
  addInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItem();
  });

  // Reset
  document.getElementById('btn-reset-checklist')?.addEventListener('click', async () => {
    await resetChecklist();
    showToast('チェックをリセットしました');
    const content = await renderChecklist();
    document.getElementById('page-main')!.innerHTML = content;
    setupChecklist();
  });
}
