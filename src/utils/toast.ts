import toast from 'react-hot-toast';
import { createElement } from 'react';
import AnimatedCheck from '@/components/common/AnimatedCheck';

export const showSuccess = (message: string) => {
  // Animierter SVG-Haken statt Default-Icon – gleiches Animations-Qualitätslevel
  // wie die Tank-Visualisierungen.
  toast.success(message, { icon: createElement(AnimatedCheck) });
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};