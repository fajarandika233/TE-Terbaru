import { useEffect, useState } from "react";

const KEY = "te-portal-theme";

// Portal light/dark switch. The chosen mode is remembered on the device and
// applied as a `dark` class on <html>, the same hook Tailwind's dark: uses.
export default function usePortalTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode: the choice simply is not remembered */
    }
    return () => root.classList.remove("dark");
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((value) => (value === "dark" ? "light" : "dark")) };
}