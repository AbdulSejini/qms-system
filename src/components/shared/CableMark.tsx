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

export default CableMark;
