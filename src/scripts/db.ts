/**
 * くるま旅ノート — IndexedDB データ層
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface Vehicle {
  id: 1; // singleton
  name: string;
  type: string;
  registeredAt: string;
}

export interface ChecklistItem {
  id?: number;
  text: string;
  checked: boolean;
  order: number;
}

export interface Memory {
  id?: number;
  date: string;           // ISO date string
  lat: number | null;
  lng: number | null;
  category: string;       // 道の駅/温泉/絶景/食事/泊まった/その他
  memo: string;
  photo: Blob | null;
  prefecture: string;
}

export interface MaintenanceItem {
  id?: number;
  name: string;
  lastDate: string | null;
  cycleMonths: number;
}

export interface Meta {
  key: string;
  value: string;
}

export type TaviDB = IDBPDatabase<{
  vehicle: { key: number; value: Vehicle };
  checklist: { key: number; value: ChecklistItem };
  memories: { key: number; value: Memory; indexes: { 'by-date': string } };
  maintenance: { key: number; value: MaintenanceItem };
  meta: { key: string; value: Meta };
}>;

let dbPromise: Promise<TaviDB> | null = null;

function getDB(): Promise<TaviDB> {
  if (!dbPromise) {
    dbPromise = openDB('kuruma-tabi-note', 1, {
      upgrade(db) {
        db.createObjectStore('vehicle', { keyPath: 'id' });

        const checklistStore = db.createObjectStore('checklist', {
          keyPath: 'id',
          autoIncrement: true,
        });
        void checklistStore;

        const memoriesStore = db.createObjectStore('memories', {
          keyPath: 'id',
          autoIncrement: true,
        });
        memoriesStore.createIndex('by-date', 'date');

        db.createObjectStore('maintenance', {
          keyPath: 'id',
          autoIncrement: true,
        });

        db.createObjectStore('meta', { keyPath: 'key' });
      },
    }) as Promise<TaviDB>;
  }
  return dbPromise;
}

// ---- Vehicle ----
export async function getVehicle(): Promise<Vehicle | undefined> {
  const db = await getDB();
  return db.get('vehicle', 1);
}

export async function saveVehicle(name: string, type: string = ''): Promise<void> {
  const db = await getDB();
  await db.put('vehicle', { id: 1, name, type, registeredAt: new Date().toISOString() });
}

// ---- Meta ----
export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDB();
  const record = await db.get('meta', key);
  return record?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

// ---- Checklist ----
export async function getChecklist(): Promise<ChecklistItem[]> {
  const db = await getDB();
  const items = await db.getAll('checklist');
  return items.sort((a, b) => a.order - b.order);
}

export async function addChecklistItem(text: string, order: number): Promise<number> {
  const db = await getDB();
  return db.add('checklist', { text, checked: false, order } as ChecklistItem) as Promise<number>;
}

export async function updateChecklistItem(item: ChecklistItem): Promise<void> {
  const db = await getDB();
  await db.put('checklist', item);
}

export async function deleteChecklistItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('checklist', id);
}

export async function resetChecklist(): Promise<void> {
  const db = await getDB();
  const items = await db.getAll('checklist');
  const tx = db.transaction('checklist', 'readwrite');
  for (const item of items) {
    await tx.store.put({ ...item, checked: false });
  }
  await tx.done;
}

export async function initDefaultChecklist(): Promise<void> {
  const db = await getDB();
  const count = await db.count('checklist');
  if (count > 0) return;

  const defaults = [
    'ポータブル電源の充電',
    '飲み水の補充',
    'ガスボンベの確認',
    '常備薬・救急セット',
    '着替え',
    'タオル',
    '戸締まりの確認',
    'ゴミ袋',
    'スマホの充電器',
  ];
  const tx = db.transaction('checklist', 'readwrite');
  for (let i = 0; i < defaults.length; i++) {
    await tx.store.add({ text: defaults[i], checked: false, order: i } as ChecklistItem);
  }
  await tx.done;
}

// ---- Memories ----
export async function getMemories(): Promise<Memory[]> {
  const db = await getDB();
  const items = await db.getAll('memories');
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getMemory(id: number): Promise<Memory | undefined> {
  const db = await getDB();
  return db.get('memories', id);
}

export async function addMemory(memory: Omit<Memory, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('memories', memory as Memory) as Promise<number>;
}

export async function updateMemory(memory: Memory): Promise<void> {
  const db = await getDB();
  await db.put('memories', memory);
}

export async function deleteMemory(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('memories', id);
}

export async function getRecentMemories(count: number = 2): Promise<Memory[]> {
  const all = await getMemories();
  return all.slice(0, count);
}

export async function getVisitedPrefectures(): Promise<string[]> {
  const all = await getMemories();
  const prefSet = new Set<string>();
  for (const m of all) {
    if (m.prefecture) prefSet.add(m.prefecture);
  }
  return Array.from(prefSet);
}

// ---- Image Resize ----
export async function resizeImage(file: File, maxWidth: number = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to resize'));
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

// ---- Prefecture detection from coordinates ----
export function detectPrefecture(lat: number, lng: number): string {
  // Simplified prefecture detection based on coordinate ranges
  // This covers the main regions of Japan
  const prefectures: Array<{ name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }> = [
    { name: '北海道', latMin: 41.3, latMax: 45.6, lngMin: 139.3, lngMax: 145.9 },
    { name: '青森県', latMin: 40.2, latMax: 41.6, lngMin: 139.4, lngMax: 141.7 },
    { name: '岩手県', latMin: 38.7, latMax: 40.5, lngMin: 140.6, lngMax: 142.1 },
    { name: '宮城県', latMin: 37.7, latMax: 39.0, lngMin: 140.2, lngMax: 141.7 },
    { name: '秋田県', latMin: 39.0, latMax: 40.5, lngMin: 139.7, lngMax: 140.9 },
    { name: '山形県', latMin: 37.7, latMax: 39.2, lngMin: 139.5, lngMax: 140.7 },
    { name: '福島県', latMin: 36.8, latMax: 38.0, lngMin: 139.1, lngMax: 141.1 },
    { name: '茨城県', latMin: 35.7, latMax: 36.9, lngMin: 139.7, lngMax: 140.9 },
    { name: '栃木県', latMin: 36.2, latMax: 37.2, lngMin: 139.3, lngMax: 140.3 },
    { name: '群馬県', latMin: 36.0, latMax: 37.1, lngMin: 138.4, lngMax: 139.7 },
    { name: '埼玉県', latMin: 35.7, latMax: 36.3, lngMin: 138.7, lngMax: 139.9 },
    { name: '千葉県', latMin: 34.9, latMax: 36.1, lngMin: 139.7, lngMax: 140.9 },
    { name: '東京都', latMin: 35.5, latMax: 35.9, lngMin: 138.9, lngMax: 139.9 },
    { name: '神奈川県', latMin: 35.1, latMax: 35.7, lngMin: 138.9, lngMax: 139.8 },
    { name: '新潟県', latMin: 36.7, latMax: 38.6, lngMin: 137.8, lngMax: 140.0 },
    { name: '富山県', latMin: 36.2, latMax: 36.9, lngMin: 136.7, lngMax: 137.8 },
    { name: '石川県', latMin: 36.1, latMax: 37.9, lngMin: 136.2, lngMax: 137.4 },
    { name: '福井県', latMin: 35.4, latMax: 36.3, lngMin: 135.5, lngMax: 136.9 },
    { name: '山梨県', latMin: 35.2, latMax: 35.9, lngMin: 138.1, lngMax: 139.1 },
    { name: '長野県', latMin: 35.2, latMax: 37.0, lngMin: 137.3, lngMax: 138.8 },
    { name: '岐阜県', latMin: 35.1, latMax: 36.5, lngMin: 136.3, lngMax: 137.7 },
    { name: '静岡県', latMin: 34.6, latMax: 35.6, lngMin: 137.5, lngMax: 139.2 },
    { name: '愛知県', latMin: 34.6, latMax: 35.4, lngMin: 136.7, lngMax: 137.8 },
    { name: '三重県', latMin: 33.7, latMax: 35.2, lngMin: 135.8, lngMax: 137.0 },
    { name: '滋賀県', latMin: 34.8, latMax: 35.7, lngMin: 135.7, lngMax: 136.5 },
    { name: '京都府', latMin: 34.8, latMax: 35.8, lngMin: 134.8, lngMax: 136.1 },
    { name: '大阪府', latMin: 34.3, latMax: 35.0, lngMin: 135.1, lngMax: 135.8 },
    { name: '兵庫県', latMin: 34.2, latMax: 35.7, lngMin: 134.2, lngMax: 135.5 },
    { name: '奈良県', latMin: 34.0, latMax: 34.8, lngMin: 135.6, lngMax: 136.2 },
    { name: '和歌山県', latMin: 33.4, latMax: 34.4, lngMin: 134.9, lngMax: 136.0 },
    { name: '鳥取県', latMin: 35.0, latMax: 35.6, lngMin: 133.2, lngMax: 134.5 },
    { name: '島根県', latMin: 34.3, latMax: 36.3, lngMin: 131.7, lngMax: 133.4 },
    { name: '岡山県', latMin: 34.4, latMax: 35.4, lngMin: 133.4, lngMax: 134.4 },
    { name: '広島県', latMin: 34.0, latMax: 35.1, lngMin: 132.0, lngMax: 133.5 },
    { name: '山口県', latMin: 33.7, latMax: 34.8, lngMin: 130.8, lngMax: 132.2 },
    { name: '徳島県', latMin: 33.7, latMax: 34.3, lngMin: 133.5, lngMax: 134.8 },
    { name: '香川県', latMin: 34.1, latMax: 34.6, lngMin: 133.5, lngMax: 134.5 },
    { name: '愛媛県', latMin: 33.0, latMax: 34.2, lngMin: 132.0, lngMax: 133.7 },
    { name: '高知県', latMin: 32.7, latMax: 33.9, lngMin: 132.5, lngMax: 134.3 },
    { name: '福岡県', latMin: 33.0, latMax: 33.9, lngMin: 130.0, lngMax: 131.2 },
    { name: '佐賀県', latMin: 33.0, latMax: 33.6, lngMin: 129.7, lngMax: 130.5 },
    { name: '長崎県', latMin: 32.5, latMax: 34.7, lngMin: 128.5, lngMax: 130.3 },
    { name: '熊本県', latMin: 32.0, latMax: 33.2, lngMin: 130.0, lngMax: 131.3 },
    { name: '大分県', latMin: 32.7, latMax: 33.8, lngMin: 130.8, lngMax: 132.1 },
    { name: '宮崎県', latMin: 31.3, latMax: 32.9, lngMin: 130.7, lngMax: 131.9 },
    { name: '鹿児島県', latMin: 27.0, latMax: 32.3, lngMin: 128.4, lngMax: 131.3 },
    { name: '沖縄県', latMin: 24.0, latMax: 27.9, lngMin: 122.9, lngMax: 131.3 },
  ];

  let bestMatch = '';
  let bestDist = Infinity;

  for (const p of prefectures) {
    if (lat >= p.latMin && lat <= p.latMax && lng >= p.lngMin && lng <= p.lngMax) {
      const centerLat = (p.latMin + p.latMax) / 2;
      const centerLng = (p.lngMin + p.lngMax) / 2;
      const dist = Math.sqrt((lat - centerLat) ** 2 + (lng - centerLng) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = p.name;
      }
    }
  }

  return bestMatch;
}
