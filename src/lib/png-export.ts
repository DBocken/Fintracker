/**
 * Exportiert einen DOM-Knoten als PNG-Download. Wiederverwendbarer Helper nach
 * dem Muster aus SankeyChart (`toPng` aus html-to-image + Anchor-Download).
 * `html-to-image` wird lazy importiert, damit es nur beim tatsächlichen Export
 * geladen wird.
 */
export async function exportNodeAsPng(node: HTMLElement, fileName: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}
