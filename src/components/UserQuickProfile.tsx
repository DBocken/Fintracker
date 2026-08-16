import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { User as UserIcon, LogIn } from "lucide-react";
import ProfileDialogContent from "@/components/ProfileDialogContent";
import { useI18n } from "@/i18n/useI18n";
import { displayNameFromIdentity } from "@/lib/identity";

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
  const { identity } = useAuth();
  const { t } = useI18n();

  const displayName = useMemo(
    () => displayNameFromIdentity(identity) ?? t('userProfile.unknownUser'),
    [identity, t],
  );

  const initials = getInitials(displayName);

  // Anonymer Modus: Login-Einstieg statt Profil (Issue #26/#28)
  if (!identity) {
    return (
      <Button asChild variant="outline" size="sm" aria-label={t('userProfile.login')} title={t('userProfile.login')}>
        <Link to="/login">
          {/* Auf sehr schmalen Phones (<360px) nur das Icon, damit der Header
              nicht überläuft; ab xs zusätzlich der Text. */}
          <LogIn className="h-3.5 w-3.5 xs:mr-1.5" aria-hidden="true" />
          <span className="hidden xs:inline">{t('userProfile.login')}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white transition-opacity hover:opacity-90"
          aria-label={t('userProfile.openProfile')}
          title={displayName}
        >
          {initials || <UserIcon className="h-4 w-4" />}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-positive ring-2 ring-background" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <ProfileDialogContent />
      </DialogContent>
    </Dialog>
  );
}
