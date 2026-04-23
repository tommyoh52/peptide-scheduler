interface LogoProps {
  className?: string;
  size?: number;
}

// Abstract mark: a geometric peptide — connected circles (amino residues)
// wrapped by a subtle "calculation" frame. Monochrome, currentColor.
export function Logo({ className, size = 28 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Peptide Calculator logo"
      className={className}
    >
      {/* Outer rounded square */}
      <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2" />
      {/* Peptide chain: three linked residues */}
      <circle cx="12" cy="20" r="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="20" cy="20" r="3.5" fill="currentColor" />
      <circle cx="28" cy="20" r="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="15.5" y1="20" x2="16.5" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="23.5" y1="20" x2="24.5" y2="20" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
