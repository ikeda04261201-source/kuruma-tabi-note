/**
 * 思い出マップ
 */
import { getMemories, getVisitedPrefectures, type Memory } from '../db';
import { navigate } from '../router';

let mapInstance: any = null;

export async function renderMap(): Promise<string> {
  const prefectures = await getVisitedPrefectures();
  const memories = await getMemories();
  const memWithLocation = memories.filter(m => m.lat && m.lng);

  return `
    <div class="pref-counter">
      <span style="font-size: var(--text-base);">訪れた都道府県</span>
      <span class="number">${prefectures.length}</span>
      <span style="font-size: var(--text-sm); color: var(--color-ink-faint);">/ 47</span>
    </div>

    ${memWithLocation.length === 0
      ? `<div class="empty-state" style="margin-top: var(--space-xl);">
           <p>この地図は、これから<br>ふたりで塗りつぶしていくものです</p>
         </div>
         <div id="map" class="map-container"></div>`
      : `<div id="map" class="map-container"></div>`
    }
  `;
}

export async function setupMap(): Promise<void> {
  const L = await import('leaflet');

  // Import leaflet CSS
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // Wait for CSS to load
  await new Promise(resolve => setTimeout(resolve, 100));

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Destroy previous map
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  const memories = await getMemories();
  const memWithLocation = memories.filter(m => m.lat && m.lng);

  // Center on Japan
  const defaultCenter: [number, number] = [36.5, 137.0];
  const defaultZoom = 5;

  mapInstance = L.map('map', {
    zoomControl: true,
    attributionControl: true,
  }).setView(defaultCenter, defaultZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18,
  }).addTo(mapInstance);

  // Custom marker icon
  const markerIcon = L.divIcon({
    html: `<div style="width: 28px; height: 28px; background: var(--color-accent, #d4764e); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    className: 'custom-marker',
  });

  // Add markers
  for (const mem of memWithLocation) {
    const marker = L.marker([mem.lat!, mem.lng!], { icon: markerIcon }).addTo(mapInstance);

    let popupContent = `<div class="map-popup-content">`;
    if (mem.photo) {
      const url = URL.createObjectURL(mem.photo);
      popupContent += `<img src="${url}" alt="">`;
    }
    if (mem.memo) {
      popupContent += `<div class="memo">${escapeHtml(mem.memo)}</div>`;
    }
    const date = new Date(mem.date);
    popupContent += `<div class="date">${date.getMonth() + 1}月${date.getDate()}日 ${mem.category}</div>`;
    popupContent += `</div>`;

    marker.bindPopup(popupContent, { maxWidth: 220 });

    marker.on('click', () => {
      marker.openPopup();
    });
  }

  // Fit bounds if we have markers
  if (memWithLocation.length > 0) {
    const group = L.featureGroup(
      memWithLocation.map(m => L.marker([m.lat!, m.lng!]))
    );
    mapInstance.fitBounds(group.getBounds().pad(0.3));
  }

  // Fix map size
  setTimeout(() => mapInstance?.invalidateSize(), 200);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
