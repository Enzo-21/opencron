"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeSwitcher() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch by not rendering current selection until mounted
  const active = mounted ? (theme === "system" ? `system` : theme ?? "system") : "system";

  const Button = ({ value, label }: { value: string; label: string }) => (
    <button
      type="button"
      onClick={() => setTheme(value)}
      className={
        "h-8 px-2 text-xs transition-colors " +
        (active === value
          ? "bg-muted text-foreground"
          : "bg-transparent text-muted-foreground hover:bg-muted")
      }
      aria-pressed={active === value}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-background">
      <Button value="light" label="Light" />
      <Button value="system" label="System" />
      <Button value="dark" label="Dark" />
    </div>
  );
}
