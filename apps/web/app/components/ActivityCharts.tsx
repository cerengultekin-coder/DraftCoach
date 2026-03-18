"use client";

import { useEffect, useRef, useMemo } from "react";

type TsPoint = {
  t: number;
  distance_km: number;
  ele: number | null;
  hr: number | null;
  speed_kmh: number | null;
};

type Props = { timeseries: TsPoint[]; locale?: "tr" | "en" };

function downsample(arr: TsPoint[], max: number): TsPoint[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

// ── Smart notes ─────────────────────────────────────────────────────────────
function elevNote(pts: TsPoint[], locale: string): string {
  const eles = pts.map(p => p.ele).filter((e): e is number => e !== null);
  if (!eles.length) return "";
  let gain = 0;
  for (let i = 1; i < eles.length; i++) if (eles[i] > eles[i-1]) gain += eles[i] - eles[i-1];
  const tr = locale === "tr";
  if (gain < 20)  return tr ? "🟢 Neredeyse düz — aero verime odaklan"         : "🟢 Nearly flat — focus on aero efficiency";
  if (gain < 100) return tr ? "🔵 Hafif tepe — kadans sürekliliği iyi"          : "🔵 Light climb — good cadence consistency";
  if (gain < 300) return tr ? "🟡 Orta tırmanış — zone 4'e girmiş olabilirsin" : "🟡 Moderate climb — you may have hit zone 4";
  return           tr ? "🔴 Zorlu tırmanış — toparlanma günü planla"            : "🔴 Hard climb — plan a recovery day";
}

function hrNote(pts: TsPoint[], locale: string): string {
  const hrs = pts.map(p => p.hr).filter((h): h is number => h !== null);
  if (!hrs.length) return "";
  const avg = hrs.reduce((a,b) => a+b, 0) / hrs.length;
  const max = Math.max(...hrs);
  const z4pct = hrs.filter(h => h > 160).length / hrs.length;
  const tr = locale === "tr";
  if (avg < 120)     return tr ? "🟢 Zone 1-2 — hafif toparlanma sürüşü"           : "🟢 Zone 1-2 — easy recovery ride";
  if (avg < 140)     return tr ? "🔵 Zone 2 — aerobik baz geliştiriyor"            : "🔵 Zone 2 — building aerobic base";
  if (avg < 155)     return tr ? "🟡 Zone 3 — tempo antrenmanı"                    : "🟡 Zone 3 — tempo training";
  if (avg < 168)     return tr ? "🟠 Zone 4 — eşik çalışması"                     : "🟠 Zone 4 — threshold effort";
  if (z4pct > 0.5)   return tr ? "🔴 Zone 5 ağırlıklı — yoğun yük, iyi dinlen"    : "🔴 Zone 5 dominant — intense load, rest well";
  return tr ? `🟠 Maks ${max} bpm — anaerobik sınıra ulaştın` : `🟠 Max ${max} bpm — you hit anaerobic threshold`;
}

function speedNote(pts: TsPoint[], locale: string): string {
  const spds = pts.map(p => p.speed_kmh).filter((s): s is number => s !== null && s < 80);
  if (!spds.length) return "";
  const avg = spds.filter(s => s > 1).reduce((a,b) => a+b, 0) / spds.filter(s => s > 1).length;
  const max = Math.max(...spds);
  const consistent = spds.filter(s => s > 1 && Math.abs(s - avg) < avg * 0.3).length / spds.length;
  const tr = locale === "tr";
  if (avg < 15)         return tr ? "🟡 Düşük hız — yokuş mu yoksa mola mı?"      : "🟡 Low speed — hills or stops?";
  if (avg < 22)         return tr ? "🔵 Orta tempo — dayanıklılık bölgesi"         : "🔵 Moderate pace — endurance zone";
  if (avg < 28)         return tr ? "🟢 İyi tempo — sürdürülebilir hız"            : "🟢 Good pace — sustainable speed";
  if (consistent > 0.7) return tr ? `🟢 Tutarlı hız — maks ${max.toFixed(0)} km/h` : `🟢 Consistent pace — max ${max.toFixed(0)} km/h`;
  return tr ? `🟠 Değişken hız — maks ${max.toFixed(0)} km/h` : `🟠 Variable pace — max ${max.toFixed(0)} km/h`;
}

// ── Chart component ───────────────────────────────────────────────────────────
function MiniChart({
  points, getValue, color, label, unit, note, borderRight = false,
}: {
  points: TsPoint[]; getValue: (p: TsPoint) => number | null;
  color: string; label: string; unit: string; note: string; borderRight?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    async function init() {
      const { default: Chart } = await import("chart.js/auto");
      const data = points
        .map(p => ({ x: +p.distance_km.toFixed(2), y: getValue(p) }))
        .filter(d => d.y !== null && d.y !== undefined && isFinite(d.y as number)) as { x: number; y: number }[];
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (!canvasRef.current) return;
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { datasets: [{ data, borderColor: color, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: color + "18", tension: 0.3 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(15,23,42,0.90)", titleColor: "#94A3B8",
              bodyColor: "#F0F4FF", padding: 8, displayColors: false,
              titleFont: { family: "'Fira Code',monospace", size: 10 },
              bodyFont:  { family: "'Fira Code',monospace", size: 11 },
              callbacks: {
                title: (i: any[]) => `${(+i[0]?.parsed?.x)?.toFixed(1)} km`,
                label: (i: any) => `${label}: ${(+i.parsed.y)?.toFixed(1)} ${unit}`,
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              ticks: { maxTicksLimit: 5, font: { family: "'Fira Code',monospace", size: 11 }, color: "#94A3B8", callback: (v: any) => `${(+v).toFixed(0)}k` },
              grid: { color: "rgba(99,140,255,0.06)" }, border: { display: false },
            },
            y: {
              ticks: { maxTicksLimit: 4, font: { family: "'Fira Code',monospace", size: 11 }, color: "#94A3B8" },
              grid: { color: "rgba(99,140,255,0.06)" }, border: { display: false },
            },
          },
        },
      });
    }
    init();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [points]);

  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      padding: "12px 16px 10px",
      borderRight: borderRight ? "1px solid rgba(99,140,255,0.10)" : "none",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{ width:16, height:2.5, background:color, borderRadius:2, display:"inline-block", flexShrink:0 }}/>
        <span style={{ fontFamily:"'Fira Code',monospace", fontSize:12, letterSpacing:"1px", textTransform:"uppercase", color:"#64748B", fontWeight:500 }}>
          {label}
        </span>
        <span style={{ fontFamily:"'Fira Code',monospace", fontSize:11, color:"#94A3B8", marginLeft:"auto" }}>{unit}</span>
      </div>
      {/* Canvas */}
      <div style={{ flex:"0 0 55%", position:"relative", minHeight:0 }}>
        <canvas ref={canvasRef} style={{ display:"block" }}/>
      </div>
      {/* Note */}
      {note && (
        <div style={{
          marginTop: 6, padding: "4px 8px", borderRadius: 6,
          background: "rgba(99,140,255,0.06)",
          fontFamily: "'Lexend',sans-serif", fontSize: 12,
          color: "var(--text-2)", lineHeight: 1.4,
          borderLeft: `2px solid ${color}`,
        }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ActivityCharts({ timeseries, locale = "tr" }: Props) {
  const pts = downsample(timeseries, 250);
  const hasEle   = pts.some(p => p.ele   !== null);
  const hasHr    = pts.some(p => p.hr    !== null);
  const hasSpeed = pts.some(p => p.speed_kmh !== null);

  const notes = useMemo(() => ({
    ele:   elevNote(pts, locale ?? "tr"),
    hr:    hrNote(pts, locale ?? "tr"),
    speed: speedNote(pts, locale ?? "tr"),
  }), [pts]);

  return (
    <div style={{ display:"flex", width:"100%", height:"100%", background:"var(--bg-2)" }}>
      {hasEle && (
        <MiniChart points={pts} getValue={p => p.ele}
          color="#06B6D4" label="Elevation" unit="m"
          note={notes.ele} borderRight={hasHr || hasSpeed}/>
      )}
      {hasHr && (
        <MiniChart points={pts} getValue={p => p.hr}
          color="#F43F5E" label="Heart Rate" unit="bpm"
          note={notes.hr} borderRight={hasSpeed}/>
      )}
      {hasSpeed && (
        <MiniChart points={pts} getValue={p => (p.speed_kmh && p.speed_kmh < 80) ? p.speed_kmh : null}
          color="#F97316" label="Speed" unit="km/h"
          note={notes.speed} borderRight={false}/>
      )}
    </div>
  );
}