/**
 * TEMPORÄRER Verifikationslauf (nicht eingecheckt): Router-Stufe 3 im echten
 * Browser mit selbst gehosteter ONNX-Laufzeit; jsdelivr geblockt wie durch
 * die Produktions-CSP.
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { startDemo } from "./fixtures/vertical-slice";

test.use({
  locale: "de-DE",
  launchOptions: {
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=4096"],
  },
});

/**
 * Der Umgebungs-Proxy resettet jede externe HTTPS-Verbindung aus Chromium —
 * die Modelldateien liegen deshalb lokal (per curl gespiegelt) und werden
 * über Playwright-Routen unter ihren ECHTEN Hugging-Face-URLs ausgeliefert.
 * Was dieser Lauf misst, bleibt der eigentliche Fix: die ONNX-Laufzeit von
 * `/ort/` statt jsdelivr.
 */
const MODELL_DIR =
  "/tmp/claude-0/-home-user-Fintracker/367e6fc1-9319-5e3a-999d-93e5d33bfb9a/scratchpad/modell";

test("Stufe 3 läuft über /ort/, nie über jsdelivr", async ({ page, context }) => {
  test.setTimeout(2_400_000);
  const ortAnfragen: string[] = [];
  const jsdelivr: string[] = [];
  let hf = 0;
  await context.route("**cdn.jsdelivr.net**", (route) => {
    jsdelivr.push(route.request().url());
    void route.abort();
  });
  await context.route("https://huggingface.co/**", (route) => {
    const url = new URL(route.request().url());
    const teil = url.pathname.split("/resolve/main/")[1];
    if (!teil || teil.includes("..")) return route.abort();
    const datei = `${MODELL_DIR}/${teil}`;
    if (!fs.existsSync(datei)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      status: 200,
      contentType: teil.endsWith(".json") ? "application/json" : "application/octet-stream",
      body: fs.readFileSync(datei),
    });
  });
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/ort/")) ortAnfragen.push(u.split("/").pop() ?? "");
    if (u.includes("huggingface.co") || u.includes("hf.co")) hf += 1;
  });
  page.on("crash", () => console.log("SEITE ABGESTÜRZT"));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("KONSOLE:", m.text().slice(0, 200));
  });

  await startDemo(page);
  await page.evaluate(() => localStorage.setItem("semantic-intent-opt-in", "1"));
  await page.goto("/fragen");
  const eingabe = page.getByLabel(/Frage zu deinen Finanzen/i);
  await expect(eingabe).toBeVisible();
  // Stufe 3 springt nur bei unverstanden/nurVermutung an — mit Demo-Bestand
  // ist das Vokabular reicher als in den Unit-Fixtures, also Fragen
  // durchprobieren, bis der Modell-Download tatsächlich startet (HF-Request).
  const fragen = [
    "was kostet mich streaming im monat eigentlich so",
    "sag mal wie schauts mit meiner kohle aus",
    "krieg ich das diesen monat noch gewuppt",
  ];
  let gestartet = false;
  for (const frage of fragen) {
    await eingabe.fill(frage);
    await page.getByRole("button", { name: /Frage stellen/i }).click();
    const vorher = hf;
    await page.waitForTimeout(8000);
    if (hf > vorher) { gestartet = true; console.log("Stufe 3 gestartet mit:", frage); break; }
    console.log("Stufe 3 nicht ausgelöst von:", frage);
  }
  expect(gestartet, "keine der Fragen hat Stufe 3 ausgelöst").toBe(true);
  const heartbeat = setInterval(() => console.log("… läuft, HF-Requests:", hf, "ORT:", ortAnfragen.length), 60_000);


  // Stufe 3: Download (~135 MB) + Embeddings. Erfolg = Marker leuchtet ODER
  // Kandidaten aus dem Modell; Misserfolg = Fehlertext in der Monospace-Zeile.
  const marker = page.locator('[data-modell="an"]');
  const fehler = page.locator("p.font-mono");
  await expect(marker.or(fehler)).toBeVisible({ timeout: 2_100_000 });
  if (await fehler.isVisible().catch(() => false)) {
    console.log("FEHLERTEXT:", (await fehler.textContent())?.slice(0, 300));
  }
  console.log("ORT-Anfragen:", JSON.stringify(ortAnfragen));
  console.log("jsdelivr (geblockt):", jsdelivr.length, "HF:", hf);
  clearInterval(heartbeat);
  await expect(marker).toBeVisible();
  expect(ortAnfragen.length).toBeGreaterThan(0);
});
