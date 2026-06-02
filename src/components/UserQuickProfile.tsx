"use client";

import { useMemo } from "react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { showSuccess } from "@/utils/toast";
import { User as UserIcon, LogOut, Settings as SettingsIcon } from "lucide-react";

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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          aria-label="Profil öffnen"
          title={displayName}
        >
          {initials || <UserIcon className="h-4 w-4" />}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <Card variant="premium">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
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
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
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
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              type="button"
            >
              <SettingsIcon className="mr-1 h-3 w-3" />
              Profil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                showSuccess("Abgemeldet");
              }}
            >
              <LogOut className="mr-1 h-3 w-3" />
              Abmelden
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}