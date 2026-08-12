'use client';

/**
 * Brand mark for the sign-in screen: a cable seen in cross-section - stranded
 * copper core, insulation, armour and outer sheath - with a current pulse
 * travelling around the armour ring.
 *
 * This is a placeholder standing in for the official Saudi Cable logo. To use
 * the real one, drop it at public/logo.svg and render an <Image> here instead;
 * nothing else on the page depends on this component's internals.
 */

interface CableMarkProps {
  /** Rendered size in pixels. */
  size?: number;
  /** Set false on decorative duplicates so the motion runs once, not per copy. */
  animated?: boolean;
  className?: string;
}

// Seven strands: one centre plus a ring of six, the standard stranded-conductor
// arrangement. Positions are on a circle of radius 9 around the centre.
const STRANDS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i * Math.PI) / 3;
  return { cx: 50 + Math.cos(angle) * 9, cy: 50 + Math.sin(angle) * 9 };
});

export function CableMark({ size = 96, animated = true, className = '' }: CableMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Saudi Cable"
    >
      <defs>
        <radialGradient id="qms-core-fill" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FDBA5C" />
          <stop offset="100%" stopColor="#D47A09" />
        </radialGradient>
        <linearGradient id="qms-sheath-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8850A" />
          <stop offset="100%" stopColor="#8A4A05" />
        </linearGradient>
      </defs>

      {/* Outer sheath */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#qms-sheath-stroke)" strokeWidth="3" opacity="0.55" />

      {/* Armour - carries the current pulse */}
      <circle cx="50" cy="50" r="34" fill="none" stroke="#E8850A" strokeWidth="1.5" opacity="0.3" />
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke="#FDBA5C"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={animated ? 'qms-current' : undefined}
      />

      {/* Insulation */}
      <circle cx="50" cy="50" r="24" fill="none" stroke="#E8850A" strokeWidth="1.5" opacity="0.45" strokeDasharray="3 5" />

      {/* Stranded conductor */}
      <g className={animated ? 'qms-strands' : undefined}>
        {STRANDS.map((strand, index) => (
          <circle key={index} cx={strand.cx} cy={strand.cy} r="5.5" fill="url(#qms-core-fill)" opacity="0.9" />
        ))}
      </g>
      <circle cx="50" cy="50" r="5.5" fill="url(#qms-core-fill)" className={animated ? 'qms-core' : undefined} />
    </svg>
  );
}

export default CableMark;
