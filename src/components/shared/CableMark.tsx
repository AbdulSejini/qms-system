'use client';

/**
 * The QMS mark: a magnifier - the audit motif - with the lens in the brand
 * amber and the handle in the foreground colour.
 *
 * Taken verbatim from the QA department's approved redesign (QMS Redesign.dc.html),
 * where it sits in the sidebar header beside the company name. Both strokes are
 * driven by CSS variables so the mark follows the light and dark themes instead
 * of carrying baked-in colours.
 */

interface CableMarkProps {
  /** Rendered size in pixels. */
  size?: number;
  /** Colour of the lens ring. Defaults to the brand amber. */
  lensColor?: string;
  /** Colour of the handle. Defaults to the current foreground. */
  handleColor?: string;
  className?: string;
  title?: string;
}

export function CableMark({
  size = 30,
  lensColor = 'var(--primary)',
  handleColor = 'currentColor',
  className = '',
  title = 'QMS',
}: CableMarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      style={{ flex: 'none' }}
    >
      <circle cx="44" cy="44" r="32" fill="none" stroke={lensColor} strokeWidth="8" />
      <path
        d="M54 54 79 79"
        fill="none"
        stroke={handleColor}
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * الشعار مع نصّه كما في هوية إدارة الجودة: العلامة، ثم «إدارة الجودة» وتحتها
 * QUALITY MANAGEMENT.
 *
 * السطران يظهران في الحالتين العربية والإنجليزية معاً لأن هذا هو الشعار نفسه، لا
 * ترجمة له: الاسم العربي هو الاسم، والسطر اللاتيني تحته جزء من رسم الهوية.
 * ويبقيان نصاً حياً لا صورة، فيتبعان حجم الخط والثيم ويظلان قابلين للتحديد والبحث.
 */
export function QualityMarkLockup({
  size = 36,
  className = '',
  showText = true,
}: {
  size?: number;
  className?: string;
  /** يُخفى النص حين ينطوي الشريط الجانبي، فتبقى العلامة وحدها. */
  showText?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <CableMark size={size} className="shrink-0" title="إدارة الجودة" />
      {showText && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold text-[var(--foreground)]">
            إدارة الجودة
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-secondary)]">
            Quality Management
          </span>
        </div>
      )}
    </div>
  );
}

export default CableMark;
