import toast from 'react-hot-toast';
import { createElement } from 'react';
import { AlertTriangle } from 'lucide-react';
import AnimatedCheck from '@/features/shared/presentation/AnimatedCheck';

export const showSuccess = (message: string) => {
  // Animierter SVG-Haken statt Default-Icon – gleiches Animations-Qualitätslevel
  // wie die Tank-Visualisierungen.
  toast.success(message, { icon: createElement(AnimatedCheck) });
};

export const showError = (message: string) => {
  toast.error(message);
};

/**
 * Hinweis, der weder Erfolg noch Fehler ist: Die App hat etwas gelesen, traut
 * dem Ergebnis aber nicht. `showError` wäre hier falsch — es ist nichts
 * schiefgegangen, und ein roter Balken für einen Zweifel stumpft die Farbe ab,
 * die echten Fehlern gehört.
 */
export const showWarning = (message: string) => {
  toast(message, { icon: createElement(AlertTriangle, { className: 'h-5 w-5 text-warning' }) });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};