export function calcUnitsForRow(opts: {
  vialMg: number;
  bacWaterMl: number;
  doseMcg: number;
  syringeType: "U-40" | "U-50" | "U-100" | string;
}): number {
  const mcgPerMl = (opts.vialMg * 1000) / (opts.bacWaterMl || 1);
  const drawMl = opts.doseMcg / (mcgPerMl || 1);
  // U-100 insulin syringe: 100 units = 1 ml
  return drawMl * 100;
}

export function formatDoseMcg(mcg: number): string {
  if (!isFinite(mcg) || mcg <= 0) return "—";
  if (mcg >= 1000) return `${(mcg / 1000).toFixed(mcg % 1000 === 0 ? 0 : 2)} mg`;
  return `${Math.round(mcg)} mcg`;
}
