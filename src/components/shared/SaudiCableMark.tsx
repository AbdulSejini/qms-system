'use client';

/**
 * شعار شركة الكابلات السعودية - The Saudi Cable Company mark.
 *
 * The company's own mark: a cable seen in cross-section - a dark sheath around seven
 * stranded conductors, one in the centre and six around it. Drawn rather than embedded,
 * because the letterhead only carries it as a raster (Letterhead.docx -> word/media/
 * image2.png) and a logo that has to look right at 24px in a sidebar and again on a
 * printed report cannot be a PNG scaled two ways.
 *
 * THE GEOMETRY IS THE REAL ONE, not an approximation of the picture. A seven-wire strand
 * has six conductors touching a seventh: every centre sits exactly 2r from the middle, so
 * neighbours touch at 2r apart and the bundle's outer edge lands at 3r. Everything below
 * follows from CONDUCTOR_R, which is why the mark stays correct at any size.
 *
 * WHY THE SHEATH IS A FIXED DARK, NOT A THEME TOKEN. This is a registered corporate mark;
 * its colours are not the application's to re-theme. The one concession is `onDark`, which
 * swaps the sheath for a transparent disc with a light rim so the mark keeps its shape
 * against the dark sidebar instead of becoming a black hole in it.
 */

// Brand colours, taken from the letterhead artwork.
const SHEATH = '#1C1C1B';
const CONDUCTOR = '#F29200';
const INSULATION = '#FFFFFF';

// The strand: six around one. Everything is derived from this radius.
const CONDUCTOR_R = 14;
const RING_R = CONDUCTOR_R * 2; // centre-to-centre, so neighbours just touch
const DISC_R = 50;

// Starting at the top and going clockwise, matching the artwork.
const CONDUCTOR_CENTRES: [number, number][] = [
  [50, 50], // the core
  ...Array.from({ length: 6 }, (_, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    return [50 + RING_R * Math.cos(angle), 50 + RING_R * Math.sin(angle)] as [number, number];
  }),
];

interface SaudiCableMarkProps {
  /** Rendered size in pixels. */
  size?: number;
  /** Render for a dark background: the sheath becomes an outlined disc instead of a solid one. */
  onDark?: boolean;
  className?: string;
  /** Accessible name. Defaults to the company name in Arabic. */
  title?: string;
}

export function SaudiCableMark({
  size = 32,
  onDark = false,
  className = '',
  title = 'شركة الكابلات السعودية',
}: SaudiCableMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      style={{ flex: 'none' }}
    >
      <title>{title}</title>

      {/* الغلاف الخارجي */}
      <circle
        cx="50"
        cy="50"
        r={onDark ? DISC_R - 1.5 : DISC_R}
        fill={onDark ? 'none' : SHEATH}
        stroke={onDark ? 'rgba(255,255,255,0.55)' : 'none'}
        strokeWidth={onDark ? 3 : 0}
      />

      {/* الموصلات السبعة - كل موصل بعازله الأبيض */}
      {CONDUCTOR_CENTRES.map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={CONDUCTOR_R}
          fill={CONDUCTOR}
          stroke={onDark ? 'rgba(255,255,255,0.9)' : INSULATION}
          strokeWidth={3.5}
        />
      ))}
    </svg>
  );
}

/**
 * The mark locked up with the company name, as it appears on the letterhead.
 * The name is live text rather than part of the artwork so it follows the locale and
 * stays selectable and searchable.
 */
export function SaudiCableLockup({
  size = 36,
  onDark = false,
  subtitle,
  className = '',
  language = 'ar',
}: {
  size?: number;
  onDark?: boolean;
  /** Small line under the company name - e.g. "QMS" or "إدارة الجودة". */
  subtitle?: string;
  className?: string;
  language?: 'ar' | 'en';
}) {
  const name = language === 'ar' ? 'شركة الكابلات السعودية' : 'Saudi Cable Company';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SaudiCableMark size={size} onDark={onDark} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-bold text-[var(--foreground)]">{name}</span>
        {subtitle && (
          <span className="text-xs font-semibold tracking-wide text-[var(--primary)]">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default SaudiCableMark;
