/* eslint-disable @next/next/no-img-element -- static export: we ship our own pre-sized WebP files */
import { photoData, type PhotoKey } from "@/content/photos";
import type { Lang } from "@/lib/i18n";

/**
 * Responsive photo from public/images. `sizes` tells the browser how wide the
 * image is drawn so phones download the small file.
 */
export function Photo({
  name,
  lang,
  sizes,
  className = "",
  priority = false,
  position,
  decorative = false,
}: {
  name: PhotoKey;
  lang: Lang;
  sizes: string;
  className?: string;
  priority?: boolean;
  position?: string;
  decorative?: boolean;
}) {
  const p = photoData(name);
  const srcSet = p.widths.map((w) => `/images/${name}-${w}.webp ${w}w`).join(", ");
  const fallback = `/images/${name}-${p.widths[Math.min(1, p.widths.length - 1)]}.webp`;
  return (
    <img
      src={fallback}
      srcSet={srcSet}
      sizes={sizes}
      width={p.width}
      height={p.height}
      alt={decorative ? "" : p.alt[lang]}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={`object-cover ${className}`}
      style={{ objectPosition: position ?? p.position, backgroundColor: p.color }}
    />
  );
}
