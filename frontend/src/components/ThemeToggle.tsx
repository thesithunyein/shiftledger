import { Moon, Sun } from "lucide-react";
import type { Theme } from "../lib/theme";

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? "is-dark" : "is-light"}`}
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <Sun className="theme-icon theme-icon-sun" size={14} strokeWidth={2.25} />
          <Moon className="theme-icon theme-icon-moon" size={14} strokeWidth={2.25} />
        </span>
      </span>
    </button>
  );
}
