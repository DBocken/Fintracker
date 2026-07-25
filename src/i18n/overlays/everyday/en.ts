import type { TranslationOverlay } from '../types';

/**
 * Everyday wording (English). Only deviations from the base tree — anything
 * missing here falls through to `translations.ts` unchanged.
 *
 * Same rules as the German overlay (see `de.ts`): describe rather than
 * infantilise, never trade accuracy for simplicity, cap labels at ~4 words,
 * and keep the exact placeholder set of the base string.
 */
export const everydayEn: TranslationOverlay = {};
