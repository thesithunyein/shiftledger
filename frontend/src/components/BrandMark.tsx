import type { Theme } from "../lib/theme";

type Props = {
  size?: number;
  className?: string;
  theme?: Theme;
};

/** Theme-aware mark: light logo by default, silver-lifted mark in dark mode. */
export function BrandMark({ size = 40, className = "", theme = "light" }: Props) {
  const src = theme === "dark" ? "/logo-dark.png" : "/logo-light.png";

  return (
    <span
      className={`brand-mark-wrap ${theme === "dark" ? "is-dark" : "is-light"} ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" draggable={false} aria-hidden="true" />
    </span>
  );
}
