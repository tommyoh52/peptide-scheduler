import { SYRINGE_MAX_UNITS, SyringeType } from "@/lib/reconstitution";

interface SyringeVizProps {
  units: number;
  syringeType: SyringeType;
  className?: string;
}

/**
 * Visual SVG syringe. Left = plunger, right = needle tip.
 * Filled portion shows liquid drawn proportional to units/maxUnits.
 * The "drawn" liquid extends from the current plunger position toward the needle.
 */
export function SyringeViz({ units, syringeType, className }: SyringeVizProps) {
  const maxUnits = SYRINGE_MAX_UNITS[syringeType];
  const clampedUnits = Math.max(0, Math.min(maxUnits, units));
  const ratio = clampedUnits / maxUnits;

  // Barrel geometry (within a 420x120 viewBox)
  const barrelX = 70;
  const barrelY = 40;
  const barrelW = 260;
  const barrelH = 40;

  // Plunger head position — moves into the barrel as dose shrinks (push plunger in).
  // When units = 0 → plunger fully pushed in (at right edge, empty).
  // When units = maxUnits → plunger at left edge (full barrel).
  // Liquid = area right of plunger head, up to barrel end.
  const emptyPortion = 1 - ratio;
  const plungerHeadX = barrelX + emptyPortion * barrelW;
  const liquidW = ratio * barrelW;

  // Tick marks every 10 units (or 10% of max)
  const tickCount = 10;
  const ticks = Array.from({ length: tickCount + 1 }).map((_, i) => {
    const x = barrelX + (i / tickCount) * barrelW;
    return x;
  });

  return (
    <svg
      viewBox="0 0 420 120"
      className={className}
      role="img"
      aria-label={`Syringe showing ${clampedUnits.toFixed(1)} of ${maxUnits} units drawn`}
    >
      {/* Plunger shaft (behind barrel, extends left) */}
      <rect
        x={10}
        y={barrelY + barrelH / 2 - 6}
        width={plungerHeadX - 10}
        height={12}
        rx={2}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
      />
      {/* Plunger thumb disc on far left */}
      <rect
        x={2}
        y={barrelY - 6}
        width={14}
        height={barrelH + 12}
        rx={3}
        fill="hsl(var(--muted-foreground) / 0.4)"
      />

      {/* Barrel outline */}
      <rect
        x={barrelX}
        y={barrelY}
        width={barrelW}
        height={barrelH}
        fill="hsl(var(--card))"
        stroke="hsl(var(--foreground) / 0.35)"
        strokeWidth={1.5}
      />

      {/* Liquid fill (medical green) */}
      {ratio > 0 && (
        <rect
          x={plungerHeadX}
          y={barrelY + 4}
          width={liquidW}
          height={barrelH - 8}
          fill="hsl(var(--primary) / 0.75)"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
        />
      )}

      {/* Plunger head (rubber stopper) */}
      <rect
        x={plungerHeadX - 4}
        y={barrelY + 2}
        width={8}
        height={barrelH - 4}
        fill="hsl(var(--foreground) / 0.65)"
        rx={1}
      />

      {/* Tick marks on top */}
      {ticks.map((x, i) => (
        <line
          key={i}
          x1={x}
          x2={x}
          y1={barrelY - 2}
          y2={barrelY - (i % 5 === 0 ? 10 : 6)}
          stroke="hsl(var(--foreground) / 0.55)"
          strokeWidth={1}
        />
      ))}
      {/* Labels every 5 ticks */}
      {ticks.map((x, i) =>
        i % 5 === 0 ? (
          <text
            key={`t-${i}`}
            x={x}
            y={barrelY - 14}
            textAnchor="middle"
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fill="hsl(var(--muted-foreground))"
          >
            {Math.round((i / tickCount) * maxUnits)}
          </text>
        ) : null,
      )}

      {/* Needle hub */}
      <rect
        x={barrelX + barrelW}
        y={barrelY + barrelH / 2 - 8}
        width={14}
        height={16}
        fill="hsl(var(--muted-foreground) / 0.55)"
      />
      {/* Needle */}
      <line
        x1={barrelX + barrelW + 14}
        x2={barrelX + barrelW + 80}
        y1={barrelY + barrelH / 2}
        y2={barrelY + barrelH / 2}
        stroke="hsl(var(--foreground) / 0.75)"
        strokeWidth={2}
      />
      {/* Needle tip */}
      <polygon
        points={`${barrelX + barrelW + 80},${barrelY + barrelH / 2 - 1.5} ${barrelX + barrelW + 94},${barrelY + barrelH / 2} ${barrelX + barrelW + 80},${barrelY + barrelH / 2 + 1.5}`}
        fill="hsl(var(--foreground) / 0.75)"
      />

      {/* Syringe label */}
      <text
        x={barrelX + barrelW / 2}
        y={barrelY + barrelH + 24}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="hsl(var(--muted-foreground))"
      >
        {syringeType} · {clampedUnits.toFixed(1)} / {maxUnits} units
      </text>
    </svg>
  );
}
