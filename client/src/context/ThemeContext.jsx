import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "echo-meet-theme";

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, default to "dark"
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  });

  // Apply theme to <html> element whenever it changes
  useEffect(() => {
    const root = document.documentElement;

    // Add transitioning class for smooth theme switch
    root.classList.add("theme-transitioning");
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Remove transitioning class after animation completes
    const timeout = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 400);

    return () => clearTimeout(timeout);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const isDark = theme === "dark";

  const value = { theme, toggleTheme, isDark };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
