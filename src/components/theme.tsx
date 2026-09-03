"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { saveTheme } from "@/app/actions";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      // Flip the attribute immediately; persist in the background. A theme
      // toggle that waits on a round trip feels broken.
      document.documentElement.dataset.theme = next;
      void saveTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
