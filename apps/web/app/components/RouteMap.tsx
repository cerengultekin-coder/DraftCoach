"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Bounds = { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
type Props  = { segments: [number, number][][]; bounds?: Bounds | null };

// ── Geometry ──────────────────────────────────────────────────────────────────
function haversineM(a: [number,number], b: [number,number]): number {
  const R = 6371000;
  const p1 = (a[0]*Math.PI)/180, p2 = (b[0]*Math.PI)/180;
  const dp = ((b[0]-a[0])*Math.PI)/180, dl = ((b[1]-a[1])*Math.PI)/180;
  const x = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function bearing(a: [number,number], b: [number,number]): number {
  const lat1=(a[0]*Math.PI)/180, lat2=(b[0]*Math.PI)/180;
  const dLon=((b[1]-a[1])*Math.PI)/180;
  const y=Math.sin(dLon)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  return ((Math.atan2(y,x)*180)/Math.PI+360)%360;
}

function buildArrows(coords: [number,number][], spacingM: number) {
  if (coords.length < 2) return [];
  const arrows: { pos: [number,number]; angle: number }[] = [];
  let accumulated = 0, nextThreshold = spacingM * 0.5;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i-1], coords[i]);
    accumulated += d;
    if (accumulated >= nextThreshold) {
      arrows.push({
        pos: [(coords[i-1][0]+coords[i][0])/2, (coords[i-1][1]+coords[i][1])/2],
        angle: bearing(coords[i-1], coords[i]),
      });
      nextThreshold += spacingM;
    }
  }
  return arrows;
}

// ── Main component (imperative Leaflet, no react-leaflet) ─────────────────────
export default function RouteMap({ segments, bounds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const rawCoords = useMemo(() => segments.flat() as [number,number][], [segments]);

  const totalM = useMemo(() => {
    let s = 0;
    for (let i = 1; i < rawCoords.length; i++) s += haversineM(rawCoords[i-1], rawCoords[i]);
    return s;
  }, [rawCoords]);

  const spacingM = useMemo(() => Math.max(250, Math.round(totalM / 10 / 50) * 50), [totalM]);
  const arrows   = useMemo(() => buildArrows(rawCoords, spacingM), [rawCoords, spacingM]);

  const validSegs = useMemo(
    () => segments.filter(s => s.length >= 2) as [number,number][][],
    [segments]
  );

  const center: [number,number] = useMemo(() => {
    if (bounds) return [(bounds.min_lat+bounds.max_lat)/2, (bounds.min_lon+bounds.max_lon)/2];
    return rawCoords[0] ?? [41.0082, 28.9784];
  }, [bounds, rawCoords]);

  // ── Bootstrap Leaflet imperatively (avoids react-leaflet container issues) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: any;
    let map: any;

    async function init() {
      // Dynamic import — avoids SSR + Turbopack CSS issues
      const leaflet = await import("leaflet");
      L = leaflet.default ?? leaflet;

      // Inject Leaflet CSS once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id   = "leaflet-css";
        link.rel  = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!containerRef.current) return;

      // StrictMode çift çalıştırma koruması
      if ((containerRef.current as any)._leaflet_id) return;

      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      setReady(true);
    }

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw route whenever map is ready or data changes ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Clear previous layers — keep tile layers (they have attribution), remove overlays
    map.eachLayer((layer: any) => {
      if (layer.options && layer.options.attribution !== undefined) return;
      map.removeLayer(layer);
    });

    // Re-import L (already loaded)
    const L = (window as any).L ?? require("leaflet");

    if (!validSegs.length) {
      map.setView(center, 13);
      return;
    }

    // Glow
    validSegs.forEach(seg => {
      L.polyline(seg, { color:"#60a5fa", weight:14, opacity:0.10, lineCap:"round", lineJoin:"round" }).addTo(map);
    });
    // Mid glow
    validSegs.forEach(seg => {
      L.polyline(seg, { color:"#3b82f6", weight:7, opacity:0.25, lineCap:"round", lineJoin:"round" }).addTo(map);
    });
    // Main line
    validSegs.forEach(seg => {
      L.polyline(seg, { color:"#60a5fa", weight:3, opacity:1, lineCap:"round", lineJoin:"round" }).addTo(map);
    });

    // Direction arrows
    arrows.forEach(({ pos, angle }) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <g transform="rotate(${angle} 11 11)">
          <polygon points="11,2 18,16 11,12 4,16"
            fill="#22d3ee" fill-opacity="0.95"
            stroke="#03060f" stroke-width="1.5" stroke-linejoin="round"/>
        </g>
      </svg>`;
      const icon = L.divIcon({ html: svg, className: "", iconSize:[22,22], iconAnchor:[11,11] });
      L.marker(pos, { icon, interactive: false }).addTo(map);
    });

    // Start / end markers
    const start = rawCoords[0];
    const end   = rawCoords[rawCoords.length - 1];

    if (start) {
      L.circleMarker(start, { radius:7, color:"#03060f", weight:2, fillColor:"#22d3ee", fillOpacity:1 }).addTo(map);
    }
    if (end && end !== start) {
      L.circleMarker(end, { radius:7, color:"#03060f", weight:2, fillColor:"#7c6ef5", fillOpacity:1 }).addTo(map);
    }

    // Fit bounds
    if (bounds) {
      map.fitBounds(
        [[bounds.min_lat, bounds.min_lon], [bounds.max_lat, bounds.max_lon]],
        { padding:[44,44], maxZoom:15 }
      );
    } else if (rawCoords.length) {
      map.setView(center, 13);
    }

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, segments, bounds]);

  return (
    <div style={{ position:"absolute", inset:0 }}>
      <div ref={containerRef} style={{ width:"100%", height:"100%" }} />
    </div>
  );
}