import { useId } from "react";
import type { SyringeType } from "@/lib/reconstitution";

interface InsulinSyringeProps {
  /** Units currently drawn */
  units: number;
  /** Which syringe: U-100 1.0mL, U-50 0.5mL, U-40 ≈ 0.3mL (U-100/30u) */
  syringeType: SyringeType;
  /** Highlight the target unit position with a vertical guide + label */
  highlightTarget?: boolean;
  className?: string;
}

interface SyringeGeometry {
  /** Max scale units displayed on the barrel */
  maxUnits: number;
  /** Gap between major numbered ticks */
  majorStep: number;
  /** Gap between minor ticks */
  minorStep: number;
  /** Human-readable volume label, e.g. "1.0 mL · U-100" */
  label: string;
}

function getGeometry(type: SyringeType): SyringeGeometry {
  if (type === "U-40") {
    // Treat U-40 as the 0.3mL / 30u syringe per spec mapping
    return { maxUnits: 30, majorStep: 5, minorStep: 1, label: "0.3 mL · 30 u" };
  }
  if (type === "U-50") {
    return { maxUnits: 50, majorStep: 5, minorStep: 1, label: "0.5 mL · 50 u" };
  }
  return { maxUnits: 100, majorStep: 10, minorStep: 2, label: "1.0 mL · 100 u" };
}

/**
 * Realistic BD-style U-100 insulin syringe.
 * Horizontal layout: plunger rod left → barrel → orange hub → needle right.
 * Liquid fills from the rubber stopper to the needle end.
 */
export function InsulinSyringe({ units, syringeType, highlightTarget = true, className }: InsulinSyringeProps) {
  const geo = getGeometry(syringeType);
  const clampedUnits = Math.max(0, Math.min(geo.maxUnits, units));
  const ratio = clampedUnits / geo.maxUnits;
  const uid = useId();

  // ViewBox — wide, short. Desktop ~640x120, scales down.
  const VB_W = 640;
  const VB_H = 120;

  // Barrel geometry
  const barrelX = 90;
  const barrelY = 42;
  const barrelW = 380;
  const barrelH = 36;
  const barrelRight = barrelX + barrelW;

  // Plunger rod: starts at x=0 (far left thumb rest), passes through into barrel
  const plungerThumbX = 0;
  const plungerThumbW = 22;
  const rodThickness = 12;
  const rodY = barrelY + barrelH / 2 - rodThickness / 2;

  // Stopper position inside barrel: when units=0, stopper is at right (needle end);
  // when full, stopper is at left (barrel start).
  const emptyPortion = 1 - ratio;
  const stopperX = barrelX + emptyPortion * barrelW;
  const stopperW = 10;

  // Liquid: from stopper to barrel right end
  const liquidX = stopperX + stopperW / 2;
  const liquidW = Math.max(0, barrelRight - liquidX);

  // Needle hub (orange) to the right of the barrel
  const hubX = barrelRight;
  const hubW = 22;
  const hubY = barrelY + 4;
  const hubH = barrelH - 8;

  // Needle
  const needleStart = hubX + hubW;
  const needleLen = 62;
  const needleY = barrelY + barrelH / 2;
  const needleTipX = needleStart + needleLen;

  // Tick positions
  const numTicks = Math.floor(geo.maxUnits / geo.minorStep);
  const ticks: Array<{ x: number; unit: number; major: boolean }> = [];
  for (let i = 0; i <= numTicks; i++) {
    const unit = i * geo.minorStep;
    const x = barrelX + (unit / geo.maxUnits) * barrelW;
    const major = unit % geo.majorStep === 0;
    ticks.push({ x, unit, major });
  }

  // Target highlight
  const targetX = barrelX + barrelW - (clampedUnits / geo.maxUnits) * barrelW;

  const glassGradId = `syr-glass-${uid}`;
  const liquidGradId = `syr-liquid-${uid}`;
  const rodGradId = `syr-rod-${uid}`;
  const innerShadowId = `syr-inner-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={className}
      role="img"
      aria-label={`Insulin syringe, ${clampedUnits.toFixed(1)} of ${geo.maxUnits} units drawn`}
      style={{ width: "100%", height: "auto" }}
    >
      <defs>
        <linearGradient id={glassGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--foreground) / 0.06)" />
          <stop offset="0.5" stopColor="hsl(var(--foreground) / 0.02)" />
          <stop offset="1" stopColor="hsl(var(--foreground) / 0.08)" />
        </linearGradient>
        <linearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#0ea5e9" stopOpacity="0.45" />
          <stop offset="1" stopColor="#0284c7" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={rodGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--muted-foreground) / 0.4)" />
          <stop offset="0.5" stopColor="hsl(var(--muted-foreground) / 0.25)" />
          <stop offset="1" stopColor="hsl(var(--muted-foreground) / 0.5)" />
        </linearGradient>
        <filter id={innerShadowId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dy="1" result="off" />
          <feComposite in="off" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inner" />
          <feFlood floodColor="#000" floodOpacity="0.25" />
          <feComposite in2="inner" operator="in" />
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>
      </defs>

      {/* === Plunger thumb rest (orange disc) === */}
      <rect
        x={plungerThumbX}
        y={barrelY - 10}
        width={plungerThumbW}
        height={barrelH + 20}
        rx={3}
        fill="#f97316"
      />
      <rect
        x={plungerThumbX + 2}
        y={barrelY - 8}
        width={plungerThumbW - 4}
        height={barrelH + 16}
        rx={2}
        fill="#fb923c"
      />

      {/* === Plunger rod (cross-shape suggestion via two stacked rects) === */}
      <rect
        x={plungerThumbW}
        y={rodY - 2}
        width={Math.max(0, stopperX - plungerThumbW)}
        height={rodThickness + 4}
        fill={`url(#${rodGradId})`}
        stroke="hsl(var(--foreground) / 0.2)"
        strokeWidth={0.5}
      />
      {/* Rod center ridge */}
      <rect
        x={plungerThumbW}
        y={rodY + rodThickness / 2 - 1}
        width={Math.max(0, stopperX - plungerThumbW)}
        height={2}
        fill="hsl(var(--foreground) / 0.25)"
      />

      {/* === Needle === */}
      {/* Needle cone/taper */}
      <polygon
        points={`${needleStart},${needleY - 1.8} ${needleTipX - 2},${needleY - 0.6} ${needleTipX},${needleY} ${needleTipX - 2},${needleY + 0.6} ${needleStart},${needleY + 1.8}`}
        fill="#cbd5e1"
        stroke="#94a3b8"
        strokeWidth={0.3}
      />
      {/* Bevel highlight */}
      <line
        x1={needleTipX - 10}
        y1={needleY - 0.3}
        x2={needleTipX}
        y2={needleY}
        stroke="#f1f5f9"
        strokeWidth={0.5}
      />

      {/* === Orange hub === */}
      <rect x={hubX} y={hubY} width={hubW} height={hubH} fill="#ea580c" />
      <rect x={hubX} y={hubY} width={hubW} height={2} fill="#fb923c" />
      <rect x={hubX} y={hubY + hubH - 2} width={hubW} height={2} fill="#9a3412" />
      {/* Hub ridges */}
      {[0.3, 0.55, 0.8].map((f) => (
        <line
          key={f}
          x1={hubX + hubW * f}
          x2={hubX + hubW * f}
          y1={hubY + 2}
          y2={hubY + hubH - 2}
          stroke="#9a3412"
          strokeWidth={0.5}
          opacity={0.6}
        />
      ))}

      {/* === Barrel (glass) === */}
      <rect
        x={barrelX}
        y={barrelY}
        width={barrelW}
        height={barrelH}
        fill={`url(#${glassGradId})`}
        stroke="hsl(var(--foreground) / 0.35)"
        strokeWidth={1}
      />

      {/* === Liquid fill === */}
      {ratio > 0 && (
        <rect
          x={liquidX}
          y={barrelY + 2}
          width={liquidW}
          height={barrelH - 4}
          fill={`url(#${liquidGradId})`}
          style={{ transition: "x 300ms ease, width 300ms ease" }}
        />
      )}

      {/* === Rubber stopper === */}
      <rect
        x={stopperX}
        y={barrelY + 1}
        width={stopperW}
        height={barrelH - 2}
        fill="#1f2937"
        stroke="#0f172a"
        strokeWidth={0.5}
        style={{ transition: "x 300ms ease" }}
      />
      <rect
        x={stopperX + stopperW - 2}
        y={barrelY + 1}
        width={2}
        height={barrelH - 2}
        fill="#111827"
        style={{ transition: "x 300ms ease" }}
      />
      <rect
        x={stopperX}
        y={barrelY + 1}
        width={2}
        height={barrelH - 2}
        fill="#111827"
        style={{ transition: "x 300ms ease" }}
      />

      {/* === Tick marks (top of barrel) === */}
      {ticks.map((t, i) => (
        <line
          key={`tick-${i}`}
          x1={t.x}
          x2={t.x}
          y1={barrelY}
          y2={barrelY + (t.major ? 10 : 5)}
          stroke="hsl(var(--foreground) / 0.7)"
          strokeWidth={t.major ? 1 : 0.6}
        />
      ))}

      {/* === Numbered labels for major ticks (above the barrel) ===
          Needle is on the right; physical insulin syringes read 10 near the
          needle and 100 near the plunger. We flip the label (not the tick
          position) so the scale reads correctly without changing geometry. */}
      {ticks
        .filter((t) => t.major && t.unit !== 0 && t.unit !== geo.maxUnits)
        .map((t) => (
          <text
            key={`num-${t.unit}`}
            x={t.x}
            y={barrelY - 6}
            textAnchor="middle"
            fontSize={9.5}
            fontFamily="Inter, ui-sans-serif, sans-serif"
            fontWeight={600}
            fill="hsl(var(--muted-foreground))"
          >
            {geo.maxUnits - t.unit}
          </text>
        ))}

      {/* === Target highlight === */}
      {highlightTarget && clampedUnits > 0 && (
        <g style={{ transition: "transform 300ms ease" }}>
          <line
            x1={targetX}
            x2={targetX}
            y1={barrelY - 18}
            y2={barrelY + barrelH + 14}
            stroke="hsl(var(--primary))"
            strokeWidth={1}
            strokeDasharray="3 3"
            style={{ transition: "x1 300ms ease, x2 300ms ease" }}
          />
          <rect
            x={targetX - 18}
            y={barrelY + barrelH + 14}
            width={36}
            height={18}
            rx={3}
            fill="hsl(var(--primary))"
            style={{ transition: "x 300ms ease" }}
          />
          <text
            x={targetX}
            y={barrelY + barrelH + 26}
            textAnchor="middle"
            fontSize={11}
            fontFamily="Inter, ui-sans-serif, sans-serif"
            fontWeight={700}
            fill="hsl(var(--primary-foreground))"
            style={{ transition: "x 300ms ease" }}
          >
            {`${clampedUnits % 1 === 0 ? clampedUnits.toFixed(0) : clampedUnits.toFixed(1)}u`}
          </text>
        </g>
      )}

      {/* Bottom meta label */}
      <text
        x={barrelX + barrelW / 2}
        y={VB_H - 4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="Inter, ui-sans-serif, sans-serif"
        fill="hsl(var(--muted-foreground))"
      >
        {geo.label}
      </text>
    </svg>
  );
}
