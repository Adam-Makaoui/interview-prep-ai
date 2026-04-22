/**
 * @fileoverview Circular brand mark that shows ONLY the eye portion of the
 * stacked badge at `/brand/logo-badge.png`.
 *
 * The provided badge is a square image with the eye icon in the upper ~55%
 * and the "Interview intel" wordmark in the lower ~45%. We only want the
 * eye in most UI contexts (nav, hero orb), so this component uses a
 * `background-image` + zoomed `background-size` + tuned `background-position`
 * to crop to the eye region inside a `rounded-full` container.
 *
 * The container is filled with the badge's exact navy background color
 * (`#010016`) so the hidden square edges of the image disappear into the
 * circle — no visible crop artifacts even on non-dark page backgrounds.
 *
 * @module components/landing/BrandMark
 */

const LOGO_BADGE_URL = "/brand/logo-badge.png";

/**
 * Shared CSS for cropping to the eye region of the 500×500 badge.
 *
 * Tuning notes (for future you):
 *   - The eye shape occupies roughly the top half of the source image
 *     (eye-center near y=28-30%, x-centered).
 *   - `background-size: 240% auto` zooms the image 2.4× so the eye fills
 *     most of the circle and the "Interview intel" wordmark underneath
 *     gets pushed outside the visible window.
 *   - `background-position: center 14%` shifts the image down just enough
 *     to land the eye at container-center.
 *   - Navy fill (#010016) matches the badge background so the hidden
 *     square edges disappear into the circle — no halo / seam.
 *
 * Adjust ONLY the two values above if the crop ever needs re-tuning;
 * every consumer inherits the change automatically.
 */
const EYE_CROP_STYLE = {
  backgroundImage: `url(${LOGO_BADGE_URL})`,
  backgroundSize: "240% auto",
  backgroundPosition: "center 14%",
  backgroundRepeat: "no-repeat",
  backgroundColor: "#010016",
} as const;

const SIZE_CLASSES = {
  sm: "h-9 w-9",
  lg: "h-20 w-20",
} as const;

type BrandMarkProps = {
  /**
   * `sm` → 36px (fits a nav bar next to the wordmark).
   * `lg` → 80px (Screen-Studio-style floating orb above the H1).
   */
  size: keyof typeof SIZE_CLASSES;
  /** Extra classes (e.g. margin, shadow overrides). */
  className?: string;
};

/**
 * Circular, crop-to-eye brand mark. Purely decorative — callers provide their
 * own accessible label when the mark accompanies a visible wordmark (`aria-hidden`)
 * or stands alone (pass `role="img"` + `aria-label` via props in future if needed).
 */
export function BrandMark({ size, className = "" }: BrandMarkProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ring-1 ring-white/10 ${SIZE_CLASSES[size]} ${className}`}
      style={EYE_CROP_STYLE}
    />
  );
}
