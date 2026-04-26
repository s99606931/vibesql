"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";

export function ThemeSync() {
  const { theme, mode, density } = useSettingsStore();

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-mode", mode);
    html.setAttribute("data-density", density);
  }, [theme, mode, density]);

  return null;
}
