import type { Theme } from "../lib/theme";

type Props = {
  size?: number;
  className?: string;
  theme?: Theme;
  /** No tile / border — mark floats on page background */
  bare?: boolean;
};

/** Theme-aware mark with transparent background (no white square). */
export function BrandMark({ size = 40, className = "", theme = "light", bare = true }: Props) {
  const src = theme === "dark" ? "/logo-dark.png" : "/logo-light.png";

  return (
    <span
      className={`brand-mark-wrap ${bare ? "is-bare" : theme === "dark" ? "is-dark" : "is-light"} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" draggable={false} aria-hidden="true" />
    </span>
  );
}
