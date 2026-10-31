export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0e1b33" />
      {/* garage: roof + walls */}
      <path d="M6.5 14.5 16 7.5l9.5 7V25h-19z" fill="#8e2f22" />
      <path d="M5.5 15 16 7.2 26.5 15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* open door with warm light */}
      <rect x="10.5" y="16" width="11" height="9" rx="1" fill="#ffc56e" />
      <path d="M10.5 18.5h11" stroke="#e8702a" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span
        className={`font-display text-[1.45rem] leading-none font-bold tracking-tight ${inverted ? "text-white" : "text-night"}`}
      >
        spazia
      </span>
    </span>
  );
}
