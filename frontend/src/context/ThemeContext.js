import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Light / dark theme for the whole app.
 * The choice is saved in this browser and kept when moving between pages.
 * With no saved choice, the computer's own setting (light or dark) is used.
 * Bootstrap 5.3 switches its own components through the data-bs-theme attribute;
 * theme.css switches the JobNest colours the same way.
 */
const STORAGE_KEY = "jobnest_theme";
const ThemeContext = createContext(null);

const systemTheme = () =>
  typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-bs-theme", theme);
  root.style.colorScheme = theme;
}

// Set the theme as soon as this file loads, before the first render, so dark mode never flashes white
if (typeof document !== "undefined") applyTheme(savedTheme() || systemTheme());

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => savedTheme() || systemTheme());
  const [userChose, setUserChose] = useState(() => Boolean(savedTheme()));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the computer's setting until the user picks a theme themselves
  useEffect(() => {
    if (userChose || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setTheme(e.matches ? "dark" : "light");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [userChose]);

  const toggleTheme = useCallback(() => {
    // A short class lets colours fade instead of jumping (skipped for reduced motion in theme.css)
    const root = document.documentElement;
    root.classList.add("theme-switching");
    setTimeout(() => root.classList.remove("theme-switching"), 400);
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable: the choice lasts for this visit only */
      }
      return next;
    });
    setUserChose(true);
  }, []);

  const value = useMemo(() => ({ theme, isDark: theme === "dark", toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
