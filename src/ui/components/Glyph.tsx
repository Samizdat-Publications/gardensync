// Plant glyphs: one drawn form per kind of plant (src/domain/plants/schema.ts GLYPH_FORMS), filled
// with the plant's own colour and outlined so pale crops (garlic, cauliflower) still read on pale soil
// and dark crops on dark soil. Shapes match the Claude Design canvas, artboard A-system. Drawn inline
// rather than through <use> so a PNG or print export of the garden carries them.
import type { GlyphForm } from '../../domain/plants/schema';

interface Props {
  form: GlyphForm;
  color: string;
  /** Rendered size in px when used standalone. Ignored when x/y/size are given for use inside an SVG. */
  size?: number;
  /** Position inside a parent SVG, in its units. */
  x?: number;
  y?: number;
  /** Accessible name; omit for decorative glyphs next to a visible name. */
  label?: string;
  class?: string;
}

const STEM = 'var(--c-stem)';

function shapes(form: GlyphForm) {
  switch (form) {
    case 'rosette':
      return (
        <g fill="currentColor">
          <ellipse cx="12" cy="7" rx="3.6" ry="5.5" />
          <ellipse cx="6.8" cy="12.5" rx="3.6" ry="5.5" transform="rotate(-62 6.8 12.5)" />
          <ellipse cx="17.2" cy="12.5" rx="3.6" ry="5.5" transform="rotate(62 17.2 12.5)" />
          <ellipse cx="8.6" cy="18" rx="3.2" ry="4.6" transform="rotate(-140 8.6 18)" />
          <ellipse cx="15.4" cy="18" rx="3.2" ry="4.6" transform="rotate(140 15.4 18)" />
        </g>
      );
    case 'root':
      return (
        <>
          <path d="M12 23 L7.5 9.5 Q12 7.2 16.5 9.5 Z" fill="currentColor" />
          <path d="M12 8.5 Q10 4.5 7.5 2 M12 8.5 Q12 4.5 12 1.2 M12 8.5 Q14 4.5 16.5 2" stroke={STEM} stroke-width="1.7" fill="none" stroke-linecap="round" />
        </>
      );
    case 'fruiting':
      return (
        <>
          <circle cx="12" cy="14.2" r="7.6" fill="currentColor" />
          <path d="M12 6.8 L10 3.6 M12 6.8 L14 3.6 M12 6.8 L8.6 7.6 M12 6.8 L15.4 7.6" stroke={STEM} stroke-width="1.7" stroke-linecap="round" />
        </>
      );
    case 'pepper':
      return (
        <>
          <path d="M8.4 7.6 C5.4 9 6.6 15.6 9.4 19.6 C10.6 21.6 13.2 22.6 14.6 20.8 C16.8 17.6 18.2 10.2 15.6 7.6 C13.8 6 10.4 6.4 8.4 7.6 Z" fill="currentColor" />
          <path d="M9.4 7.4 Q12 5.6 14.6 7.4 M12 6.4 Q12.2 3.4 14.6 1.8" stroke={STEM} stroke-width="1.7" fill="none" stroke-linecap="round" />
        </>
      );
    case 'vine':
      return (
        <>
          <ellipse cx="11" cy="14.5" rx="8.4" ry="5.6" transform="rotate(-25 11 14.5)" fill="currentColor" />
          <path d="M17 7.5 q3.4 -1 3.2 -4.2 q-0.1 -1.4 -1.6 -1.4" stroke={STEM} stroke-width="1.6" fill="none" stroke-linecap="round" />
        </>
      );
    case 'pod':
      return (
        <>
          <path d="M3.5 19 Q6 8 20 4.5 Q14.5 16 3.5 19 Z" fill="currentColor" />
          <g fill="#ffffff" opacity="0.45" stroke="none">
            <circle cx="8.8" cy="14.6" r="1.4" />
            <circle cx="12.4" cy="11.8" r="1.4" />
            <circle cx="15.7" cy="9" r="1.3" />
          </g>
        </>
      );
    case 'allium':
      return (
        <>
          <path d="M12 22.5 C5.8 22.5 5.4 16.4 9 13.2 L11 10.4 L13 10.4 L15 13.2 C18.6 16.4 18.2 22.5 12 22.5 Z" fill="currentColor" />
          <path d="M11 10.4 L8.8 2 M12 10.4 L12 1 M13 10.4 L15.2 2" stroke={STEM} stroke-width="1.7" stroke-linecap="round" />
        </>
      );
    case 'brassica':
      return (
        <>
          <rect x="11" y="15" width="2" height="7.5" fill={STEM} stroke="none" />
          <g fill="currentColor">
            <circle cx="7.8" cy="11.2" r="4.1" />
            <circle cx="16.2" cy="11.2" r="4.1" />
            <circle cx="12" cy="7.4" r="4.3" />
            <circle cx="12" cy="13.2" r="4.1" />
          </g>
        </>
      );
    case 'sprig':
      return (
        <>
          <path d="M12 22.5 V2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <g fill="currentColor">
            <ellipse cx="8.4" cy="16.4" rx="3.6" ry="1.8" transform="rotate(-30 8.4 16.4)" />
            <ellipse cx="15.6" cy="13.2" rx="3.6" ry="1.8" transform="rotate(30 15.6 13.2)" />
            <ellipse cx="8.7" cy="9.6" rx="3.1" ry="1.6" transform="rotate(-30 8.7 9.6)" />
            <ellipse cx="15.3" cy="6.4" rx="2.7" ry="1.4" transform="rotate(30 15.3 6.4)" />
          </g>
        </>
      );
    case 'flower':
      return (
        <>
          <g fill="currentColor">
            <circle cx="12" cy="5.4" r="3.7" />
            <circle cx="18.3" cy="10" r="3.7" />
            <circle cx="15.9" cy="17.4" r="3.7" />
            <circle cx="8.1" cy="17.4" r="3.7" />
            <circle cx="5.7" cy="10" r="3.7" />
          </g>
          <circle cx="12" cy="12.2" r="3.1" fill="#f2c94c" />
        </>
      );
    case 'tuber':
      return (
        <>
          <path d="M4.6 14.2 C3.6 8 10 4.8 15.2 6.8 C21.4 9.2 21.2 16.4 16.2 18.8 C11 21.4 5.6 19.4 4.6 14.2 Z" fill="currentColor" />
          <g fill="#ffffff" opacity="0.4" stroke="none">
            <circle cx="10" cy="11" r="1.1" />
            <circle cx="15.2" cy="13.2" r="1.1" />
            <circle cx="11" cy="16.2" r="1.1" />
          </g>
        </>
      );
    case 'cane':
      return (
        <>
          <g fill="currentColor">
            <circle cx="8.8" cy="15" r="3.5" />
            <circle cx="15.2" cy="15" r="3.5" />
            <circle cx="12" cy="19.6" r="3.4" />
          </g>
          <path d="M12 12 Q12 5.8 18.5 2.8 Q16.4 9.4 12 12 Z" fill={STEM} />
        </>
      );
    case 'stalk':
      return (
        <>
          <g stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
            <path d="M9 22.5 V6.5" />
            <path d="M15 22.5 V9.5" />
          </g>
          <path d="M9 6.5 l-2.2 -3.4 M9 6.5 l2.2 -3.4 M15 9.5 l-2.2 -3.4 M15 9.5 l2.2 -3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </>
      );
  }
}

export function Glyph({ form, color, size = 24, x, y, label, class: cls }: Props) {
  const inSvg = x !== undefined && y !== undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...(inSvg ? { x, y } : {})}
      class={cls}
      style={{ color, overflow: 'visible' }}
      // The outline is inherited by every shape that does not set its own stroke.
      stroke="var(--c-glyph-edge)"
      stroke-width="0.9"
      stroke-linejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true', focusable: 'false' })}
    >
      {shapes(form)}
    </svg>
  );
}
