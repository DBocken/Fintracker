import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";

function applyTheme(next: "dark" | "light") {
  const root = document.documentElement;
  if (next === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("color-scheme", next);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("color-scheme") as "dark" | "light" | null) || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className={cn("bg-background/50 backdrop-blur-sm", className)}
      aria-label={t('theme.toggleLabel')}
      title={theme === "dark" ? t('theme.darkModeLabel') : t('theme.lightModeLabel')}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default ThemeToggle;