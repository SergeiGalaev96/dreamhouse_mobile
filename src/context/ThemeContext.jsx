import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const THEME_STORAGE_KEY = "dreamhouse_theme";

export const ThemeContext = createContext({
  theme: "dark",
  isDark: true,
  setTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === "dark";

    root.classList.toggle("dark", isDark);
    body.classList.toggle("dark", isDark);
    body.style.backgroundColor = isDark ? "#020617" : "#f8fafc";
    body.style.color = isDark ? "#ffffff" : "#111827";
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch((error) => {
        console.warn("status bar overlay setup failed", error);
      });

      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch((error) => {
        console.warn("status bar style setup failed", error);
      });

      StatusBar.setBackgroundColor({ color: isDark ? "#030712" : "#f8fafc" }).catch((error) => {
        console.warn("status bar color setup failed", error);
      });
    }
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === "dark",
    setTheme
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
