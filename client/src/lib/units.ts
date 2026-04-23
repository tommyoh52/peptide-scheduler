export type UnitPreference = "auto" | "mcg" | "mg";

/**
 * Format a mcg value for display, honoring the user's unit preference.
 * Values are always stored as mcg; this only affects display.
 */
export function formatDose(mcg: number, pref: UnitPreference = "auto"): string {
  if (!isFinite(mcg)) return "—";
  if (pref === "mcg") return `${mcg.toLocaleString()} mcg`;
  if (pref === "mg") {
    const mg = mcg / 1000;
    return `${formatMg(mg)} mg`;
  }
  // auto
  if (Math.abs(mcg) >= 1000) {
    const mg = mcg / 1000;
    return `${formatMg(mg)} mg`;
  }
  return `${mcg.toLocaleString()} mcg`;
}

function formatMg(mg: number): string {
  if (mg % 1 === 0) return mg.toLocaleString();
  const decimals = (mg.toString().split(".")[1] || "").length;
  return mg.toFixed(Math.min(3, decimals));
}

// ===== Weight conversions =====
export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}
export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

// ===== Height conversions =====
export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches - ft * 12);
  return { ft, in: inch };
}

export function formatWeight(valueLb: number | null | undefined, unit: "lb" | "kg" = "lb"): string {
  if (valueLb == null || !isFinite(valueLb)) return "—";
  if (unit === "kg") return `${lbToKg(valueLb).toFixed(1)} kg`;
  return `${valueLb.toFixed(1)} lb`;
}

export function formatHeight(valueInches: number | null | undefined, unit: "imperial" | "metric" = "imperial"): string {
  if (valueInches == null || !isFinite(valueInches)) return "—";
  if (unit === "metric") return `${(valueInches * 2.54).toFixed(0)} cm`;
  const ft = Math.floor(valueInches / 12);
  const inch = Math.round(valueInches - ft * 12);
  return `${ft}'${inch}"`;
}

/** Format a mcg range, honoring the user's unit preference. */
export function formatDoseRange(minMcg: number, maxMcg: number, pref: UnitPreference = "auto"): string {
  if (minMcg === maxMcg) return formatDose(minMcg, pref);
  // Both ends should share a unit — pick based on the larger end for consistency in auto.
  if (pref === "auto") {
    if (maxMcg >= 1000) {
      return `${formatMg(minMcg / 1000)}–${formatMg(maxMcg / 1000)} mg`;
    }
    return `${minMcg.toLocaleString()}–${maxMcg.toLocaleString()} mcg`;
  }
  if (pref === "mg") {
    return `${formatMg(minMcg / 1000)}–${formatMg(maxMcg / 1000)} mg`;
  }
  return `${minMcg.toLocaleString()}–${maxMcg.toLocaleString()} mcg`;
}
