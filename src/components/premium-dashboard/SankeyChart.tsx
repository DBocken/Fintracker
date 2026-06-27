import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Network } from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import { chartColorAt } from "@/lib/chart-colors";
import { buildTransactionsHref } from "@/components/dashboard/filter-utils";
import type { SankeyData } from "@/lib/analysis-data";
import { buildSankeyModel } from "@/lib/sankey-model";

interface SankeyChartProps {
  data: SankeyData;
  /**
   * Drilldown in Unterkategorien per Klick (Issue #40): Im Basis-Dashboard
   * deaktiviert (einfaches Sankey auf Hauptkategorien-Ebene ist der
   * Aha-Moment und FREE), im Analyse-Bereich aktiviert.
   */
  enableDrilldown?: boolean;
}

export function SankeyChart({ data, enableDrilldown = true }: SankeyChartProps) {
  // Wenn keine Hauptkategorien vorhanden sind, macht das Diagramm keinen Sinn.
  // Die Prüfung muss nach den Hooks erfolgen (Rules of Hooks).
  const hasData = !!data && Array.isArray(data.mainCategories) && data.mainCategories.length > 0;

  const navigate = useNavigate();
  const [expandedMainId, setExpandedMainId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [percentMode, setPercentMode] = useState<boolean>(false);
  const [chartHeight, setChartHeight] = useState<number>(500);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const totalExpenses = useMemo(
    () => (data?.mainCategories ?? []).reduce((sum, m) => sum + (m.amount || 0), 0),
    [data]
  );

  const sankeyData = useMemo(
    () => buildSankeyModel(data, { isMobile, expandedMainId }),
    [data, isMobile, expandedMainId],
  );

  // Mindestbreite: Ein Sankey wächst in die BREITE mit der Spalten-/Tiefen-Anzahl,
  // nicht mit der Knotenzahl – viele Kategorien stapeln sich vertikal. Auf Mobil
  // richten wir die Breite daher an den Spalten aus, damit die Grafik in den
  // Viewport passt (kein erzwungenes Horizontal-Scrollen). Desktop behält die
  // großzügigere, knotenbasierte Breite bei.
  const minChartWidth = useMemo(() => {
    const layer = (t?: string) =>
      t === "income" ? 0 : t === "account" ? 1 : t === "expense-sub" ? 3 : 2;
    const columns = new Set(sankeyData.nodes.map((n) => layer(n.type))).size || 2;
    if (isMobile) return Math.max(columns * 150, 300);
    return Math.max((sankeyData.nodes.length || 1) * 90, 640);
  }, [sankeyData.nodes, isMobile]);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine Daten für Flussdiagramm verfügbar</p>
          <p className="text-sm mt-2">
            Importiere Transaktionen, um die Visualisierung zu sehen
          </p>
        </div>
      </div>
    );
  }

  const formatAmount = (type: string | undefined, amount?: number) => {
    if (amount === undefined || amount === null) return null;

    if (!percentMode) {
      return amount.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
    }

    // Prozentdarstellung abhängig vom Knotentyp
    let denom = 0;
    if (type === "income") {
      denom = data.totalIncome;
    } else if (type === "account" || type === "expense-main" || type === "expense-sub") {
      denom = totalExpenses;
    }

    if (denom <= 0) return "0%";
    const pct = (amount / denom) * 100;
    return `${pct.toFixed(1)}%`;
  };

  const handleExportPNG = async () => {
    if (!containerRef.current) return;
    const dataUrl = await toPng(containerRef.current, { cacheBust: true, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = "sankey.png";
    link.href = dataUrl;
    link.click();
  };

  const handleExportJPEG = async () => {
    if (!containerRef.current) return;
    const dataUrl = await toJpeg(containerRef.current, { quality: 0.95, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = "sankey.jpg";
    link.href = dataUrl;
    link.click();
  };

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    const [dataUrl, { default: jsPDF }] = await Promise.all([
      toPng(containerRef.current, { cacheBust: true, backgroundColor: "#ffffff" }),
      import("jspdf"),
    ]);
    const pdf = new jsPDF("landscape", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save("sankey.pdf");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Geldfluss-Visualisierung
        </CardTitle>
        <CardDescription>
          {enableDrilldown
            ? "Zeigt den Fluss von Einnahmen (grün, links) über deine Konten (mit Netto-Anzeige) zu Ausgabenkategorien (je Kategorie eine Farbe). Klicke auf eine Kategorie, um die Unterkategorien einzublenden."
            : "Zeigt den Fluss von Einnahmen (grün, links) über deine Konten (mit Netto-Anzeige) zu deinen Hauptkategorien (je Kategorie eine Farbe)."}
        </CardDescription>
        {enableDrilldown && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            💡 <strong>Tipp:</strong> Klicke auf eine Ausgabenkategorie, um in die Unterkategorien zu wechseln. Beim Hover über einen Fluss siehst du den genauen Betrag.
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Steuerleiste */}
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={percentMode} onCheckedChange={(v) => setPercentMode(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Prozentwerte</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportPNG}>Export PNG</Button>
              <Button size="sm" variant="outline" onClick={handleExportJPEG}>Export JPEG</Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF}>Export PDF</Button>
            </div>
          </div>
          {/* Höhen-Slider: auf Mobile kompakt, auf SM+ in Reihe mit Export */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Höhe:</span>
            <Slider
              value={[chartHeight]}
              min={300}
              max={800}
              step={20}
              onValueChange={(vals) => setChartHeight(vals[0] || 500)}
              className="flex-1 sm:w-40"
            />
            <span className="text-xs text-muted-foreground w-12 text-right">{chartHeight}px</span>
            <div className="hidden sm:flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExportPNG}>Export PNG</Button>
              <Button size="sm" variant="outline" onClick={handleExportJPEG}>Export JPEG</Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF}>Export PDF</Button>
            </div>
          </div>
        </div>

        {expandedMainId && (
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Fokus: {data.mainCategories.find((m) => m.id === expandedMainId)?.name || "Kategorie"}
            </div>
            <Button size="sm" variant="outline" onClick={() => setExpandedMainId(null)}>
              Gesamtansicht
            </Button>
          </div>
        )}

        {/* Defizit-Hinweis statt eines erfundenen „Übrig"-Knotens (Mobil, Gesamtansicht). */}
        {isMobile && !expandedMainId && data.totalIncome > 0 && totalExpenses > data.totalIncome && (
          <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Ausgaben über Einnahmen in diesem Zeitraum.
          </div>
        )}

        {/* Chart-Wrapper: horizontal scroll auf Mobile, normal auf Desktop */}
        <div
          ref={scrollContainerRef}
          style={{ minWidth: 0 }}
          className="overflow-x-auto [-webkit-overflow-scrolling:touch]"
        >
          <div
            ref={containerRef}
            style={{
              height: `${chartHeight}px`,
              minWidth: `${minChartWidth}px`,
            }}
            className="w-full"
          >
            {/* Cross-Fade beim Drilldown: Knoten/Links poppen nicht um, sondern
                blenden sanft (baseline: Aufbau statt Pop). reduced-motion → kein Fade. */}
            <motion.div
              key={expandedMainId ?? "root"}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full w-full"
            >
            <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              nodePadding={40}
              margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
              link={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.35 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              node={({ x, y, width, height, payload }: any) => {
                const MIN_HEIGHT_FOR_LABELS = 36;
                const rectHeight = Math.max(height, 20);
                const isAccountNode = payload.type === "account";
                const isSmallNode = isAccountNode || rectHeight < MIN_HEIGHT_FOR_LABELS;
                const isMainCategory =
                  enableDrilldown &&
                  data.mainCategories.some((main) => main.id === payload.id);
                const isExpanded = expandedMainId === payload.id;
                // Kategorie-Knoten verlinken auf die gefilterte Buchungsseite.
                const isCategoryNode =
                  payload.type === "expense-main" || payload.type === "expense-sub";

                const handleClick = () => {
                  // Hauptkategorie mit aktivem Drilldown: erst auf-/zuklappen.
                  if (isMainCategory) {
                    setExpandedMainId((current) =>
                      current === payload.id ? null : payload.id
                    );
                    return;
                  }
                  // Sonst (Unterkategorie, oder Hauptkategorie ohne Drilldown):
                  // zur gefilterten Buchungsseite navigieren.
                  if (isCategoryNode) {
                    navigate(buildTransactionsHref({ category: payload.id }));
                  }
                };
                const isClickable = isMainCategory || isCategoryNode;

                // Farb-Logik: Kategorie-spezifische Farben wie im Sunburst
                let fillColor = "hsl(var(--chart-net))";
                if (payload.type === "income") {
                  fillColor = "hsl(var(--chart-income))"; // Mint für Einnahmen
                } else if (payload.type === "savings") {
                  fillColor = "hsl(var(--chart-income))"; // „Übrig" wie Einnahmen (Mint)
                } else if (payload.type === "account") {
                  // Konten in ihrer eigenen Farbe (aus den Kontoeinstellungen)
                  fillColor = payload.color || "hsl(var(--chart-net))";
                } else if (payload.type === "expense-main") {
                  // Jede Hauptkategorie bekommt eigene Farbe aus der Palette; der
                  // mobile „Weitere"-Bucket (nicht in mainCategories) bleibt neutral.
                  const mainIndex = data.mainCategories.findIndex((m) => m.id === payload.id);
                  fillColor = mainIndex >= 0 ? chartColorAt(mainIndex, data.mainCategories.length) : "hsl(var(--chart-net))";
                } else if (payload.type === "expense-sub") {
                  // Subcategories: gleiche Farbe wie die übergeordnete Hauptkategorie
                  const subCategory = data.subCategories.find((s) => s.id === payload.id);
                  const mainIndex = subCategory
                    ? data.mainCategories.findIndex((m) => m.id === subCategory.mainId)
                    : 0;
                  fillColor = chartColorAt(mainIndex, data.mainCategories.length);
                }

                const amountLabel = formatAmount(payload.type, payload.amount);
                const netLabel =
                  isAccountNode && typeof payload.net === "number"
                    ? `Netto: ${payload.net >= 0 ? "+" : ""}${payload.net.toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}`
                    : null;
                const netColor = (payload.net ?? 0) >= 0 ? "hsl(var(--chart-income))" : "hsl(var(--chart-expense))";

                return (
                  <g
                    onClick={handleClick}
                    onMouseEnter={() => setHoveredId(payload.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      cursor: isClickable ? "pointer" : "default",
                      opacity: hoveredId && hoveredId !== payload.id ? 0.6 : 1,
                    }}
                  >
                    {/* Node-Box */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={rectHeight}
                      fill={fillColor}
                      stroke={
                        (hoveredId === payload.id || isExpanded) && isMainCategory
                          ? "hsl(var(--brand))"
                          : "hsl(var(--card))"
                      }
                      strokeWidth={(hoveredId === payload.id || isExpanded) && isMainCategory ? 3 : 2}
                      rx={4}
                    />

                    {/* Labels: zentriert-innen bei großen Nodes, außen rechts bei kleinen */}
                    {isSmallNode ? (
                      <>
                        {/* Kleine Node: Labels rechts außerhalb (3 Zeilen für Konten mit Netto) */}
                        <text
                          x={x + width + 6}
                          y={y + rectHeight / 2 - (netLabel ? 14 : 8)}
                          textAnchor="start"
                          dominantBaseline="middle"
                          fill="hsl(var(--foreground))"
                          fontSize={11}
                          fontWeight="bold"
                        >
                          {payload.name}
                        </text>
                        {amountLabel && (
                          <text
                            x={x + width + 6}
                            y={y + rectHeight / 2 + (netLabel ? 2 : 8)}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fill="hsl(var(--muted-foreground))"
                            fontSize={10}
                          >
                            {amountLabel}
                          </text>
                        )}
                        {netLabel && (
                          <text
                            x={x + width + 6}
                            y={y + rectHeight / 2 + 18}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fill={netColor}
                            fontSize={10}
                            fontWeight="bold"
                          >
                            {netLabel}
                          </text>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Große Node: Labels zentriert-innen */}
                        <text
                          x={x + width / 2}
                          y={y + rectHeight / 2 - 6}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={12}
                          fontWeight="bold"
                        >
                          {payload.name}
                        </text>
                        {amountLabel && (
                          <text
                            x={x + width / 2}
                            y={y + rectHeight / 2 + 12}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize={10}
                          >
                            {amountLabel}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              }}
            >
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  padding: "8px 12px",
                }}
                formatter={(value: number, name: string) => {
                  const formatted = value.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  });
                  return [formatted, name];
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) => {
                  if (typeof label === "object" && label?.value) {
                    return `Fluss: ${label.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`;
                  }
                  return `Fluss: ${label}`;
                }}
              />
            </Sankey>
          </ResponsiveContainer>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}