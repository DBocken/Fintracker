import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { User as UserIcon, LogIn } from "lucide-react";
import ProfileDialogContent from "@/components/ProfileDialogContent";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Einziger Profil-Einstieg der App (oben rechts im Header). Früher gab es
 * ein zweites, identisches Profil unten links in der Sidebar — beide wurden
 * hier zusammengeführt, damit es nur EINEN Ort fürs Profil gibt.
 */
export default function UserQuickProfile() {
  const { user } = useAuth();

  const displayName = useMemo(() => {
    return (
      (user?.user_metadata?.full_name as string) ||
      (user?.user_metadata?.name as string) ||
      user?.email ||
      "Unbekannter Nutzer"
    );
  }, [user]);

  const initials = getInitials(displayName);

  // Anonymer Modus: Login-Einstieg statt Profil (Issue #26/#28)
  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" aria-label="Anmelden" title="Anmelden">
        <Link to="/login">
          {/* Auf sehr schmalen Phones (<360px) nur das Icon, damit der Header
              nicht überläuft; ab xs zusätzlich der Text. */}
          <LogIn className="h-3.5 w-3.5 xs:mr-1.5" aria-hidden="true" />
          <span className="hidden xs:inline">Anmelden</span>
        </Link>
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white transition-opacity hover:opacity-90"
          aria-label="Profil öffnen"
          title={displayName}
        >
          {initials || <UserIcon className="h-4 w-4" />}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-positive ring-2 ring-background" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <ProfileDialogContent />
      </DialogContent>
    </Dialog>
  );
}
