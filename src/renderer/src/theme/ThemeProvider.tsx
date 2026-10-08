import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSettingsStore } from "@renderer/state/settingsStore";

const ThemeContext = createContext<"dark" | "light">("dark");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.settings?.ui.theme ?? "dark");
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolved = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.dataset["theme"] = resolved;
  }, [resolved]);

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

export function useResolvedTheme(): "dark" | "light" {
  return useContext(ThemeContext);
}
