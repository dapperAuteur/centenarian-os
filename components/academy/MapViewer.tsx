'use client';

// components/academy/MapViewer.tsx
// Interactive Leaflet map for geography lessons.
// Renders markers, polylines (trade routes), and polygons (regions) with popups.
// Must be dynamically imported with ssr: false.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  color?: string;
}

interface LineData {
  id: string;
  coords: [number, number][];
  title: string;
  color?: string;
  description?: string;
}

interface PolygonData {
  id: string;
  coords: [number, number][];
  title: string;
  color?: string;
  fillColor?: string;
  description?: string;
}

export interface MapContent {
  center: [number, number];
  zoom: number;
  markers?: MarkerData[];
  lines?: LineData[];
  polygons?: PolygonData[];
}

interface MapViewerProps {
  mapContent: MapContent;
}

// Fix Leaflet default marker icon issue with bundlers
function createMarkerIcon(color?: string) {
  const fillColor = color || '#e879f9'; // fuchsia-400
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 2.4.7 4.6 1.9 6.5L12.5 41l10.6-22c1.2-1.9 1.9-4.1 1.9-6.5C25 5.6 19.4 0 12.5 0z" fill="${fillColor}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -41],
  });
}

export default function MapViewer({ mapContent }: MapViewerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current).setView(mapContent.center, mapContent.zoom);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add markers. Tooltip shows the title on hover so students
    // immediately know the marker is interactive; popup (click) shows
    // the full description.
    if (mapContent.markers) {
      for (const m of mapContent.markers) {
        const marker = L.marker([m.lat, m.lng], {
          icon: createMarkerIcon(m.color),
          keyboard: true,
          title: m.title, // native browser tooltip fallback
        }).addTo(map);
        if (m.title) {
          marker.bindTooltip(m.title, { direction: 'top', offset: L.point(0, -36), opacity: 0.92 });
        }
        if (m.title || m.description) {
          marker.bindPopup(`<strong>${m.title}</strong>${m.description ? `<br/><span style="font-size:12px;color:#666">${m.description}</span>` : ''}`);
        }
      }
    }

    // Add lines (trade routes). Dashed already, plus hover tooltip +
    // cursor-pointer affordance. Thicker on hover so the hit area is
    // forgiving and the click cue is obvious.
    if (mapContent.lines) {
      for (const line of mapContent.lines) {
        const polyline = L.polyline(line.coords, {
          color: line.color || '#818cf8', // indigo-400
          weight: 3,
          opacity: 0.8,
          dashArray: '8 4',
          interactive: true,
        }).addTo(map);
        const el = polyline.getElement() as SVGPathElement | null;
        if (el) el.style.cursor = 'pointer';
        if (line.title) {
          polyline.bindTooltip(line.title, { sticky: true, opacity: 0.92 });
        }
        polyline.on('mouseover', () => polyline.setStyle({ weight: 5, opacity: 1 }));
        polyline.on('mouseout', () => polyline.setStyle({ weight: 3, opacity: 0.8 }));
        if (line.title || line.description) {
          polyline.bindPopup(`<strong>${line.title}</strong>${line.description ? `<br/><span style="font-size:12px;color:#666">${line.description}</span>` : ''}`);
        }
      }
    }

    // Add polygons (regions). Hover tooltip + slight fill-opacity
    // boost on hover so students see the region responds to their mouse.
    if (mapContent.polygons) {
      for (const poly of mapContent.polygons) {
        const polygon = L.polygon(poly.coords, {
          color: poly.color || '#34d399', // emerald-400
          fillColor: poly.fillColor || poly.color || '#34d39933',
          fillOpacity: 0.3,
          weight: 2,
          interactive: true,
        }).addTo(map);
        const el = polygon.getElement() as SVGPathElement | null;
        if (el) el.style.cursor = 'pointer';
        if (poly.title) {
          polygon.bindTooltip(poly.title, { sticky: true, opacity: 0.92 });
        }
        polygon.on('mouseover', () => polygon.setStyle({ fillOpacity: 0.5, weight: 3 }));
        polygon.on('mouseout', () => polygon.setStyle({ fillOpacity: 0.3, weight: 2 }));
        if (poly.title || poly.description) {
          polygon.bindPopup(`<strong>${poly.title}</strong>${poly.description ? `<br/><span style="font-size:12px;color:#666">${poly.description}</span>` : ''}`);
        }
      }
    }

    // Invalidate size after initial render to handle container sizing
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [mapContent]);

  return (
    // `isolation: isolate` wraps Leaflet's internal z-index stack
    // (panes at z-400, controls at z-1000) in its own compositing
    // context so the map can't float over other page chrome — the
    // DocumentViewer modal (z-60) would otherwise render *behind*
    // Leaflet's controls and the student sees map tiles covering
    // the PDF they opened.
    <div className="mb-6 isolate">
      {/* Discoverability hint above the map so students know the
          markers/lines/regions are clickable. Leaflet's only built-in
          affordance is cursor:pointer, which isn't enough signal. */}
      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">💡</span>
        <span>Hover any marker, line, or region to see its label — click to open full details. Drag to pan · scroll to zoom.</span>
      </p>
      <div
        ref={mapRef}
        className="w-full aspect-video rounded-xl sm:rounded-2xl overflow-hidden border border-gray-800"
        style={{ minHeight: 300 }}
      />
    </div>
  );
}
