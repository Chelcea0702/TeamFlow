import React, { createContext, useContext, useEffect, useState } from "react";

// Theme preference is stored in localStorage (browser-bound), matching the
// documented known limitation: it does not carry across devices. Toggling
// updates a data-theme attribute on <html>, which CSS variables key off of,
// so the switch applies instantly with no page reload.

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("teamflow_theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("teamflow_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

