import { Link } from "react-router-dom";
import { Lock, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalEncryption } from "@/components/providers/LocalEncryptionProvider";

/**
 * Privacy-Indikator (#41, #54): Schloss im Header jedes Screens.
 * Zeigt den echten Zustand der lokalen Verschlüsselung und kommuniziert
 * das Privacy-Versprechen („Deine Daten bleiben auf deinem Gerät").
 */
export default function PrivacyIndicator() {
  const { enabled, unlocked } = useLocalEncryption();

  const Icon = enabled ? (unlocked ? ShieldCheck : Lock) : ShieldAlert;
  const iconClass = enabled ? "text-positive" : "text-muted-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Datenschutz-Status">
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              {enabled
                ? unlocked
                  ? "Lokal verschlüsselt & entsperrt"
                  : "Lokal verschlüsselt & gesperrt"
                : "Daten bleiben auf deinem Gerät"}
            </p>
            <p className="text-muted-foreground">
              {enabled
                ? "Deine Finanzdaten sind mit deinem Passwort verschlüsselt und verlassen dein Gerät nicht."
                : "Deine Finanzdaten verlassen dein Gerät nicht. Aktiviere die Verschlüsselung für zusätzlichen Schutz."}
            </p>
            {!enabled && (
              <Link
                to="/settings"
                className="inline-block pt-1 font-medium text-brand underline-offset-2 hover:underline"
              >
                Verschlüsselung aktivieren
              </Link>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
