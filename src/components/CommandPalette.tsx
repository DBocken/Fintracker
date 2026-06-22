import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Plus, Settings } from "lucide-react";
import { getVisibleNavGroups } from "@/components/layout/nav-config";
import { useI18n } from "@/i18n/useI18n";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type QuickAction = {
  labelKey: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  shortcut?: string;
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-command-palette", onOpen);
    return () => window.removeEventListener("open-command-palette", onOpen);
  }, []);

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        labelKey: "nav.items.csv",
        label: "CSV importieren",
        icon: Upload,
        onSelect: () => navigate("/csv"),
        shortcut: "G",
      },
      {
        labelKey: "premium.addWidget",
        label: "Widget hinzufügen",
        icon: Plus,
        onSelect: () => {
          navigate("/premium");
          window.dispatchEvent(new CustomEvent("open-add-widget"));
        },
        shortcut: "W",
      },
      {
        labelKey: "nav.items.settings",
        label: "Einstellungen",
        icon: Settings,
        onSelect: () => navigate("/settings"),
        shortcut: ",",
      },
    ],
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput placeholder={t("shell.search") + "…"} />
        <CommandList>
          <CommandEmpty>{t("common.noResults", "Keine Ergebnisse gefunden.")}</CommandEmpty>

          <CommandGroup heading="Quick Actions">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem
                  key={a.labelKey}
                  onSelect={() => {
                    setOpen(false);
                    a.onSelect();
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{t(a.labelKey, a.label)}</span>
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {getVisibleNavGroups().map((g) => (
            <CommandGroup key={g.id} heading={t(g.labelKey ?? "", g.label)}>
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.path}
                    onSelect={() => {
                      setOpen(false);
                      navigate(item.path);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>
                      {item.requiredTier === "premium"
                        ? `${t(item.labelKey ?? "", item.label)} (${t("shell.premium")})`
                        : t(item.labelKey ?? "", item.label)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}