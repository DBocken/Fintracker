import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { LocalEncryptionSettings } from '../LocalEncryptionSettings';

/**
 * WP 3.3 (SEC-3): `estimatePasswordStrength` bewertete ein Passwort nur noch
 * einen visuellen Balken — niemand fragte den Wert ab, `1234` verschlüsselte
 * Finanzdaten ohne jede Hürde. Diese Suite belegt das neue Gate: ein
 * schwaches Passwort blockiert den Setup-Button, ein expliziter,
 * nicht-vorausgewählter Override hebt die Blockade wieder auf.
 *
 * AGENTS.md §6: bilingual über `@/test-utils/render`, kein lokaler
 * Provider-Mock — nur der Context-Hook wird gemockt, exakt wie im
 * bestehenden Auto-Lock-Test (`LocalEncryptionSettings.autolock.test.tsx`).
 *
 * `DEFAULT_WORDING` ist 'everyday' (`src/i18n/wording.ts`) — ohne expliziten
 * dritten Parameter rendert `renderWithI18n` bereits die Alltagssprache. Die
 * Fachsprache (Basisbaum) wird deshalb hier gezielt über `wording:
 * 'technical'` geprüft, nicht umgekehrt.
 */

const enable = vi.fn();

vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({
    enabled: false,
    unlocked: false,
    autoLockMinutes: 10,
    setAutoLockMinutes: vi.fn(),
    lockOnHidden: false,
    setLockOnHidden: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    enable,
    disable: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const WEAK_PASSWORD = '1234';
const STRONG_PASSWORD = 'g7$Kp2!qLm9#Zx';

const OVERRIDE_LABEL_DE_EVERYDAY = 'Ich weiß, dass das riskant ist, und mache trotzdem weiter.';
const OVERRIDE_LABEL_DE_TECHNICAL =
  'Ich verstehe das Risiko und richte die Verschlüsselung trotzdem mit diesem Passwort ein.';
const OVERRIDE_LABEL_EN_EVERYDAY = 'I understand this is risky and want to continue anyway.';
const OVERRIDE_LABEL_EN_TECHNICAL =
  'I understand the risk and want to set up encryption with this password anyway.';

async function fillPasswordAndConfirm(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(screen.getByLabelText('Passphrase'), value);
  await user.type(screen.getByLabelText('Passphrase bestätigen'), value);
}

function getSetupButton() {
  return screen.getByRole('button', { name: 'Passphrase einrichten' });
}

describe('[SECURITY] LocalEncryptionSettings — Passwort-Mindeststärke als Gate (WP 3.3, SEC-3)', () => {
  beforeEach(() => {
    enable.mockClear();
  });

  it('[SECURITY] sollte den Setup-Button bei einem schwachen Passwort ohne Override blockieren und einen erzwungenen Klick ignorieren', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de');

    await fillPasswordAndConfirm(user, WEAK_PASSWORD);

    const button = getSetupButton();
    expect(button).toBeDisabled();

    // "ein erzwungener Submit richtet nichts aus": auch ein direkter Klick
    // auf das (im echten Browser deaktivierte) Element darf `enable` nicht
    // auslösen — die Prüfung sitzt daher zusätzlich im Handler selbst.
    button.removeAttribute('disabled');
    await user.click(button);
    expect(enable).not.toHaveBeenCalled();
  });

  it('[SECURITY] sollte das Einrichten mit schwachem Passwort erst nach explizitem Override erlauben', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de');

    await fillPasswordAndConfirm(user, WEAK_PASSWORD);

    const checkbox = screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_EVERYDAY });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const button = getSetupButton();
    expect(button).toBeEnabled();

    await user.click(button);
    expect(enable).toHaveBeenCalledWith(WEAK_PASSWORD);
  });

  it('[SECURITY] sollte ein starkes Passwort ohne Override-Schritt zulassen', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de');

    await fillPasswordAndConfirm(user, STRONG_PASSWORD);

    // Keine neue Reibung fuer den, der es richtig macht: keine
    // Override-Checkbox im Baum.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    const button = getSetupButton();
    expect(button).toBeEnabled();

    await user.click(button);
    expect(enable).toHaveBeenCalledWith(STRONG_PASSWORD);
  });

  it('[SECURITY] sollte den Override nicht vorauswählen und nicht ueber Enter im Passwortfeld auslösen', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de');

    const passwordField = screen.getByLabelText('Passphrase');
    await user.type(passwordField, WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Passphrase bestätigen'), WEAK_PASSWORD);

    const checkbox = screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_EVERYDAY });
    expect(checkbox).not.toBeChecked();

    await user.type(passwordField, '{Enter}');
    expect(checkbox).not.toBeChecked();
    expect(getSetupButton()).toBeDisabled();
    expect(enable).not.toHaveBeenCalled();
  });

  it('[SECURITY] sollte die Override-Bestätigung zurücksetzen, wenn das Passwort danach geändert wird', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de');

    const passwordField = screen.getByLabelText('Passphrase');
    await user.type(passwordField, WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Passphrase bestätigen'), WEAK_PASSWORD);

    const checkbox = screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_EVERYDAY });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Anderes (weiterhin schwaches) Passwort -> Bestätigung gilt nicht mehr
    // automatisch fort.
    await user.type(passwordField, '5');
    const refreshedCheckbox = screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_EVERYDAY });
    expect(refreshedCheckbox).not.toBeChecked();
    expect(getSetupButton()).toBeDisabled();
  });

  it('should block the setup button for a weak password without override, in English', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'en');

    await user.type(screen.getByLabelText('Passphrase'), WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Confirm passphrase'), WEAK_PASSWORD);

    expect(screen.getByRole('button', { name: 'Set up passphrase' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: OVERRIDE_LABEL_EN_EVERYDAY })).not.toBeChecked();
  });

  it('sollte in Deutsch die Alltagssprache-Fassung der Risiko-Bestätigung zeigen (Standard-Sprachstil)', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de', 'everyday');

    await user.type(screen.getByLabelText('Passphrase'), WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Passphrase bestätigen'), WEAK_PASSWORD);

    expect(screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_EVERYDAY })).toBeInTheDocument();
    expect(
      screen.getByText('Dieses Passwort ist leicht zu knacken. Selbst die beste Verschlüsselung schützt dann kaum.'),
    ).toBeInTheDocument();
  });

  it('sollte in Deutsch bei explizitem Fachsprach-Stil die Basistexte zeigen (nicht die Alltagssprache)', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'de', 'technical');

    await user.type(screen.getByLabelText('Passphrase'), WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Passphrase bestätigen'), WEAK_PASSWORD);

    expect(screen.getByRole('checkbox', { name: OVERRIDE_LABEL_DE_TECHNICAL })).toBeInTheDocument();
    expect(screen.queryByText(OVERRIDE_LABEL_DE_EVERYDAY)).not.toBeInTheDocument();
  });

  it('should show the everyday-wording risk confirmation in English (default wording)', async () => {
    const user = userEvent.setup();
    renderWithI18n(<LocalEncryptionSettings />, 'en', 'everyday');

    await user.type(screen.getByLabelText('Passphrase'), WEAK_PASSWORD);
    await user.type(screen.getByLabelText('Confirm passphrase'), WEAK_PASSWORD);

    expect(screen.getByRole('checkbox', { name: OVERRIDE_LABEL_EN_EVERYDAY })).toBeInTheDocument();
    expect(screen.queryByText(OVERRIDE_LABEL_EN_TECHNICAL)).not.toBeInTheDocument();
  });
});
