import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const THEME_STORAGE_KEY = "interviewprep-theme";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Must mirror the inline boot script in frontend/index.html exactly —
// if these diverge, React's first render will flip the class set by
// the boot script and the page will flash the wrong theme.
//   1. Explicit user choice in localStorage wins.
//   2. OS preference via `prefers-color-scheme: dark` is honored on
//      first visit (iOS Dark Mode, macOS/Windows system theme).
//   3. Fallback → "dark" (our brand default) when the media query is
//      unavailable or returns false on a system without a preference.
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  } catch {
    return "dark";
  }
}

export function applyThemeToDocument(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  // Apply theme → document on every change, but DO NOT persist on
  // first mount. Persisting on mount would stamp whatever we resolved
  // from `prefers-color-scheme` into localStorage, pinning the user
  // to that theme forever — defeats the OS-follows-theme contract.
  // We only persist on explicit user action (setTheme/toggleTheme).
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Listen for OS/browser theme changes and reflow our state IF the
  // user hasn't made an explicit choice yet (localStorage empty).
  // Once they've toggled in Settings, their choice is sticky.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY) !== null) return;
      } catch {
        return;
      }
      setThemeState(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const persistAndSet = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* private-mode Safari and friends — just skip persistence */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => persistAndSet(t), [persistAndSet]);
  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
