import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { User as UserIcon, LogIn, Settings as SettingsIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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

  const email = user?.email || "";
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
        <Card variant="premium">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
              {initials || <UserIcon className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-base">{displayName}</CardTitle>
              <CardDescription className="text-xs">
                {email}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="rounded-full bg-positive/10 px-2 py-0.5 text-xs text-positive">
                Angemeldet
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nutzer-ID</span>
              <span className="font-mono text-xs text-muted-foreground">{user?.id || "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Anmeldung über Supabase. Du kannst dich per E‑Mail registrieren oder mit
              Google anmelden.
            </p>
          </CardContent>

          <CardFooter className="flex justify-between gap-2">
            {/* Schließt den Dialog (DialogClose) und navigiert zu den
                Einstellungen — vorher war der Button ohne Wirkung. */}
            <DialogClose asChild>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to="/settings">
                  <SettingsIcon className="mr-1 h-3 w-3" />
                  Einstellungen
                </Link>
              </Button>
            </DialogClose>
            <LogoutButton className="text-xs text-muted-foreground" />
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}