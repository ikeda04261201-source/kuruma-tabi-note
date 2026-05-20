/**
 * 旅の記録をつける
 */
import {
  addMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  resizeImage,
  detectPrefecture,
  type Memory,
} from '../db';
import { navigate } from '../router';
import { showToast } from '../toast';
import { icons } from '../icons';

const CATEGORIES = ['道の駅', '温泉', '絶景', '食事', '泊まった', 'その他'];

let currentPhoto: Blob | null = null;
let currentLat: number | null = null;
let currentLng: number | null = null;
let editingMemory: Memory | null = null;

export async function renderRecord(params?: Record<string, string>): Promise<string> {
  const editId = params?.id ? Number(params.id) : null;
  editingMemory = null;
  currentPhoto = null;
  currentLat = null;
  currentLng = null;

  if (editId) {
    const mem = await getMemory(editId);
    if (mem) {
      editingMemory = mem;
      currentPhoto = mem.photo;
      currentLat = mem.lat;
      currentLng = mem.lng;
    }
  }

  const isEdit = !!editingMemory;
  const title = isEdit ? 'この記録を見る' : '今ここを記録する';
  const selectedCategory = editingMemory?.category || '';
  const memo = editingMemory?.memo || '';

  const categoriesHtml = CATEGORIES.map(cat => `
    <button type="button" class="category-tag ${cat === selectedCategory ? 'selected' : ''}"
            data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  const locationText = currentLat && currentLng
    ? `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`
    : '';

  return `
    <h2 class="mb-lg" style="font-family: var(--font-serif);">${title}</h2>

    <!-- 写真 -->
    <div class="mb-lg">
      <label>写真（なくてもOK）</label>
      <div class="photo-upload" id="photo-area">
        ${currentPhoto
          ? `<img id="photo-preview" src="${URL.createObjectURL(currentPhoto)}" alt="撮った写真">`
          : `<span>${icons.camera} タップして写真を選ぶ</span>`
        }
      </div>
      <input type="file" id="photo-input" accept="image/*" capture="environment"
             style="display: none;">
    </div>

    <!-- 場所 -->
    <div class="mb-lg">
      <label>場所</label>
      <div style="display: flex; gap: var(--space-sm); align-items: center;">
        <button class="btn btn-secondary" id="btn-get-location" style="flex-shrink: 0;">
          ${icons.mapPin} 現在地を取得
        </button>
        <span id="location-display" style="font-size: var(--text-sm); color: var(--color-ink-light); flex: 1;">
          ${locationText || '場所が入ります'}
        </span>
      </div>
      <p id="location-status" style="font-size: 14px; color: var(--color-ink-faint); margin-top: var(--space-xs);"></p>
    </div>

    <!-- 種類 -->
    <div class="mb-lg">
      <label>どんな場所？</label>
      <div class="category-selector" id="category-selector">
        ${categoriesHtml}
      </div>
    </div>

    <!-- ひとこと -->
    <div class="mb-lg">
      <label for="memo-input">ひとこと（なくてもOK）</label>
      <textarea id="memo-input" placeholder="今日の気分や、この場所のこと">${memo}</textarea>
    </div>

    <!-- 保存ボタン -->
    <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
      <button class="btn btn-primary" id="btn-save-memory">
        ${isEdit ? 'この記録を更新する' : 'この場所をとっておく'}
      </button>
      ${isEdit ? `
        <button class="btn btn-ghost" id="btn-delete-memory" style="color: #c06a44;">
          この記録を消す
        </button>
      ` : ''}
    </div>

    <p style="text-align: center; font-size: 14px; color: var(--color-ink-faint); margin-top: var(--space-md); font-family: var(--font-serif);">
      電波がなくても大丈夫。ちゃんと手元に残ります
    </p>
  `;
}

export function setupRecord(params?: Record<string, string>): void {
  let selectedCategory = editingMemory?.category || '';

  // Photo
  const photoArea = document.getElementById('photo-area')!;
  const photoInput = document.getElementById('photo-input') as HTMLInputElement;

  photoArea.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    currentPhoto = await resizeImage(file);
    const preview = document.getElementById('photo-preview') as HTMLImageElement;
    if (preview) {
      preview.src = URL.createObjectURL(currentPhoto);
    } else {
      photoArea.innerHTML = `<img id="photo-preview" src="${URL.createObjectURL(currentPhoto)}" alt="撮った写真">`;
    }
  });

  // Location
  document.getElementById('btn-get-location')?.addEventListener('click', () => {
    const statusEl = document.getElementById('location-status')!;
    const displayEl = document.getElementById('location-display')!;
    statusEl.textContent = '場所を探しています…';

    if (!navigator.geolocation) {
      statusEl.textContent = '位置情報が使えない端末です';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
        displayEl.textContent = `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
        const pref = detectPrefecture(currentLat, currentLng);
        statusEl.textContent = pref ? `${pref}あたりですね` : '場所を取得しました';
      },
      () => {
        statusEl.textContent = '場所が取れませんでした。あとで地図からピンを置けます';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  // Auto-get location on new record
  if (!editingMemory) {
    document.getElementById('btn-get-location')?.click();
  }

  // Category
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = (btn as HTMLElement).dataset.category!;
    });
  });

  // Save
  document.getElementById('btn-save-memory')?.addEventListener('click', async () => {
    const memo = (document.getElementById('memo-input') as HTMLTextAreaElement).value.trim();
    const prefecture = currentLat && currentLng ? detectPrefecture(currentLat, currentLng) : '';

    const memoryData = {
      date: editingMemory?.date || new Date().toISOString(),
      lat: currentLat,
      lng: currentLng,
      category: selectedCategory || 'その他',
      memo,
      photo: currentPhoto,
      prefecture,
    };

    if (editingMemory?.id) {
      await updateMemory({ ...memoryData, id: editingMemory.id });
      showToast('記録を更新しました');
    } else {
      await addMemory(memoryData);
      showToast('この場所をとっておきました');
    }

    navigate('home');
  });

  // Delete
  document.getElementById('btn-delete-memory')?.addEventListener('click', async () => {
    if (editingMemory?.id) {
      await deleteMemory(editingMemory.id);
      showToast('記録を消しました');
      navigate('home');
    }
  });
}
