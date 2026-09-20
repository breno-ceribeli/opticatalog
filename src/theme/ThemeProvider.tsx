import { createContext, useContext, useMemo, ReactNode } from "react";
import { useColorScheme } from "react-native";
import { buildTheme, Theme } from "./themes";

const ThemeContext = createContext<Theme>(buildTheme("light"));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(
    () => buildTheme(scheme === "dark" ? "dark" : "light"),
    [scheme]
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}