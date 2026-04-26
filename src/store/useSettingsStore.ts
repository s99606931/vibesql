import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  theme: "indigo" | "emerald" | "amber" | "rose" | "slate";
  mode: "light" | "dark";
  density: "compact" | "regular" | "comfy";
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  temperature: number;
  alwaysExplain: boolean;
  readOnly: boolean;
  sessionTimeout: number;
  notifySuccess: boolean;
  notifyError: boolean;
  notifyLong: boolean;
  setTheme: (t: SettingsState["theme"]) => void;
  setMode: (m: SettingsState["mode"]) => void;
  setDensity: (d: SettingsState["density"]) => void;
  setDialect: (d: SettingsState["dialect"]) => void; // matches DbDialect in types/index.ts
  setTemperature: (v: number) => void;
  setSessionTimeout: (v: number) => void;
  toggle: (key: "alwaysExplain" | "readOnly" | "notifySuccess" | "notifyError" | "notifyLong") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "indigo",
      mode: "dark",
      density: "regular",
      dialect: "postgresql",
      temperature: 0.3,
      alwaysExplain: false,
      readOnly: true,
      sessionTimeout: 30,
      notifySuccess: true,
      notifyError: true,
      notifyLong: false,

      setTheme: (t) => set({ theme: t }),
      setMode: (m) => set({ mode: m }),
      setDensity: (d) => set({ density: d }),
      setDialect: (d) => set({ dialect: d }),
      setTemperature: (v) => set({ temperature: v }),
      setSessionTimeout: (v) => set({ sessionTimeout: v }),
      toggle: (key) => set((s) => ({ [key]: !s[key] })),
    }),
    { name: "vibesql-settings" }
  )
);
