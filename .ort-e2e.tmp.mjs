// Laufzeit-Nachweis im ECHTEN Browser: Stufe 3 mit selbst gehosteter
// ONNX-Laufzeit. jsdelivr wird geblockt wie in Produktion durch die CSP.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext();
const seite = await ctx.newPage();

const anfragen = { ort: [], jsdelivr: [], hf: 0 };
await ctx.route('**cdn.jsdelivr.net**', (route) => {
  anfragen.jsdelivr.push(route.request().url());
  route.abort(); // Produktion: CSP-Block
});
seite.on('request', (r) => {
  const u = r.url();
  if (u.includes('/ort/')) anfragen.ort.push(u.split('/').pop());
  if (u.includes('huggingface.co') || u.includes('hf.co')) anfragen.hf += 1;
});
seite.on('console', (m) => { if (m.type() === 'error') console.log('KONSOLE:', m.text().slice(0, 200)); });

await seite.goto(BASE + '/');
await seite.getByRole('button', { name: 'Demo ansehen' }).click();
await seite.waitForURL(/coach/, { timeout: 60000 });
for (const name of ['Später entscheiden', 'Später entscheiden', 'Nicht jetzt']) {
  try { await seite.getByRole('button', { name }).click({ timeout: 8000 }); } catch {}
}
// Opt-in setzen und zur Fragen-Fläche
await seite.evaluate(() => localStorage.setItem('semantic-intent-opt-in', '1'));
await seite.goto(BASE + '/fragen');
// Einstiegs-Dialoge können hier (erneut) stehen — alle beenden, bis keiner mehr da ist.
for (let i = 0; i < 5; i++) {
  const offen = await seite.locator('[role="dialog"]').count();
  if (offen === 0) break;
  for (const name of ['Später entscheiden', 'Nicht jetzt', 'Schließen', 'Close']) {
    try { await seite.getByRole('button', { name }).first().click({ timeout: 2000 }); break; } catch {}
  }
  try { await seite.keyboard.press('Escape'); } catch {}
  await seite.waitForTimeout(500);
}
await seite.screenshot({ path: '/tmp/claude-0/-home-user-Fintracker/367e6fc1-9319-5e3a-999d-93e5d33bfb9a/scratchpad/fragen.png' });
await seite.waitForSelector('input[aria-label]');

// Frage, die Stufe 0-2 nachweislich nicht trägt
await seite.fill('input[aria-label]', 'hab ich noch luft diesen monat');
await seite.click('button[type="submit"]');

// Warten bis Stufe 3 fertig ist: Marker data-modell="an" oder Fehlertext
const start = Date.now();
let ausgang = 'timeout';
while (Date.now() - start < 900000) {
  const marker = await seite.locator('[data-modell]').first().getAttribute('data-modell').catch(() => null);
  const fehler = await seite.locator('.font-mono').first().textContent().catch(() => null);
  if (marker === 'an') { ausgang = 'MODELL-ROUTING'; break; }
  if (fehler && fehler.trim()) { ausgang = 'FEHLER: ' + fehler.trim().slice(0, 300); break; }
  await seite.waitForTimeout(2000);
}
console.log('AUSGANG:', ausgang);
console.log('ORT-Anfragen:', JSON.stringify(anfragen.ort));
console.log('jsdelivr-Anfragen (geblockt):', anfragen.jsdelivr.length);
console.log('HF-Anfragen:', anfragen.hf);
const kandidaten = await seite.locator('button').allTextContents();
console.log('Knöpfe:', JSON.stringify(kandidaten.filter(t => t.trim()).slice(0, 12)));
await browser.close();
