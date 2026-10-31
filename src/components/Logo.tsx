import { BRAND, MARK, WORDMARK_PATH } from "./logoPaths";

type Tone = "color" | "white";

function MarkShapes({ gradientId, tone, strokeWidth = 36, highlight = true }: { gradientId: string; tone: Tone; strokeWidth?: number; highlight?: boolean }) {
  const stroke = tone === "white" ? "#ffffff" : `url(#${gradientId})`;
  return (
    <>
      {tone === "color" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="60" x2="0" y2="690" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={BRAND.tealTop} />
            <stop offset="1" stopColor={BRAND.slateBottom} />
          </linearGradient>
        </defs>
      )}
      <g fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK.roof} />
        <path d={MARK.walls} strokeLinecap="butt" />
        <path d={MARK.shield} />
      </g>
      {highlight && (
        <path
          d={MARK.highlight}
          fill="none"
          stroke={tone === "white" ? "rgb(255 255 255 / 0.45)" : BRAND.highlight}
          strokeWidth="18"
        />
      )}
      <g fill={tone === "white" ? "#ffffff" : BRAND.keyhole}>
        <circle cx="440" cy="452" r="43" />
        <path d={MARK.keyholeStem} />
      </g>
    </>
  );
}

/** The house/shield mark on its own. */
export function LogoMark({
  className = "h-9 w-auto",
  tone = "color",
  id = "spazia-mark",
}: {
  className?: string;
  tone?: Tone;
  id?: string;
}) {
  return (
    <svg viewBox="40 40 800 660" className={className} aria-hidden="true">
      <MarkShapes gradientId={id} tone={tone} />
    </svg>
  );
}

/** Mark + "Spazia" wordmark, side by side. Height is set by the className. */
export function Logo({
  className = "h-8 w-auto sm:h-9",
  tone = "color",
  id = "spazia-logo",
}: {
  className?: string;
  tone?: Tone;
  id?: string;
}) {
  const scale = 5;
  return (
    <svg viewBox="40 40 2620 660" className={className} role="img" aria-label="Spazia">
      <MarkShapes gradientId={id} tone={tone} />
      <path
        transform={`translate(960 ${551 - 100 * scale}) scale(${scale})`}
        d={WORDMARK_PATH}
        fill={tone === "white" ? "#ffffff" : BRAND.wordmark}
      />
    </svg>
  );
}
