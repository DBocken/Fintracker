import { EnhancedSettings } from '../components/settings/EnhancedSettings';

// Einstellungen sind bewusst NICHT tier-gated (Issue #42): auch anonyme
// Nutzer brauchen Zugriff auf Kategorien, lokale Verschlüsselung, Backups
// und die Danger-Zone. Bank-spezifische Bereiche gaten sich selbst.
export default function SettingsPage() {
  return <EnhancedSettings />;
}
