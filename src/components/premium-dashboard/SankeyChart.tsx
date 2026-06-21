import { useMemo, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Network } from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import { chartColorAt } from "@/lib/chart-colors";
import type { SankeyData } from "@/lib/analysis-data";

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

  const [expandedMainId, setExpandedMainId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [percentMode, setPercentMode] = useState<boolean>(false);
  const [chartHeight, setChartHeight] = useState<number>(500);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const totalExpenses = useMemo(
    () => (data?.mainCategories ?? []).reduce((sum, m) => sum + (m.amount || 0), 0),
    [data]
  );

  const sankeyData = useMemo(() => {
    if (!data || !Array.isArray(data.mainCategories) || data.mainCategories.length === 0) {
      return { nodes: [], links: [] };
    }
    const nodes: {
      name: string;
      id: string;
      type?: string;
      amount?: number;
      net?: number;
      color?: string;
    }[] = [];

    const links: {
      source: number;
      target: number;
      value: number;
      label?: string;
    }[] = [];

    const nodeIndexById: Record<string, number> = {};

    // Konten mit Aktivität (Fallback auf generisches "Konto", falls keine
    // Konto-Zuordnung in den Daten vorhanden ist).
    const accountsAll =
      data.accounts && data.accounts.length > 0
        ? data.accounts
        : [
            {
              id: "account",
              name: "Konto",
              income: data.totalIncome,
              expenses: totalExpenses,
              net: data.totalIncome - totalExpenses,
              color: undefined as string | undefined,
            },
          ];

    // Im Fokusmodus nur Konten zeigen, die in dieser Kategorie auch
    // tatsächlich Ausgaben haben – sonst entstünden verwaiste Knoten.
    const focusedMain = expandedMainId
      ? data.mainCategories.find((m) => m.id === expandedMainId)
      : null;
    const accountsToShow = focusedMain
      ? accountsAll.filter((acc) => (focusedMain.byAccount[acc.id] ?? 0) > 0)
      : accountsAll;

    // Einnahmen-Knoten (nur in Gesamtansicht, und nur wenn Einnahmen vorhanden sind)
    if (!expandedMainId && data.totalIncome > 0) {
      nodes.push({
        name: "Einnahmen",
        id: "income",
        type: "income",
        amount: data.totalIncome,
      });
      nodeIndexById["income"] = nodes.length - 1;
    }

    // Konto-Knoten: einer pro aktivem Konto, mit Netto-Anzeige
    accountsToShow.forEach((acc) => {
      const nodeIndex = nodes.length;
      nodeIndexById[acc.id] = nodeIndex;

      const displayAmount = focusedMain ? focusedMain.byAccount[acc.id] ?? 0 : acc.expenses;

      nodes.push({
        name: acc.name,
        id: acc.id,
        type: "account",
        amount: displayAmount,
        net: expandedMainId ? undefined : acc.net,
        color: acc.color,
      });

      if (!expandedMainId && data.totalIncome > 0 && acc.income > 0) {
        links.push({
          source: nodeIndexById["income"],
          target: nodeIndex,
          value: Math.round(acc.income),
          label: `Einnahmen → ${acc.name}`,
        });
      }
    });

    // Konten → Hauptkategorien (Fokus: nur die expandierte Hauptkategorie anzeigen)
    const mainsToShow = expandedMainId
      ? data.mainCategories.filter((m) => m.id === expandedMainId)
      : data.mainCategories;

    mainsToShow.forEach((main) => {
      const nodeIndex = nodes.length;
      nodeIndexById[main.id] = nodeIndex;

      nodes.push({
        name: main.name,
        id: main.id,
        type: "expense-main",
        amount: main.amount,
      });

      accountsToShow.forEach((acc) => {
        const value = Math.round(main.byAccount[acc.id] ?? 0);
        if (value > 0) {
          links.push({
            source: nodeIndexById[acc.id],
            target: nodeIndex,
            value,
            label: `${acc.name} → ${main.name}`,
          });
        }
      });
    });

    // Ausgewählte Hauptkategorie → Unterkategorien (Top-N + Rest-Bucket für Übersicht)
    if (expandedMainId) {
      const subsAll = data.subCategories
        .filter((sub) => sub.mainId === expandedMainId && sub.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      const MAX_SUBS = 6;
      const totalAmount = subsAll.reduce((sum, s) => sum + s.amount, 0);
      const topSubs = subsAll.slice(0, MAX_SUBS);
      const topAmount = topSubs.reduce((sum, s) => sum + s.amount, 0);
      const restAmount = totalAmount - topAmount;

      const mainIndex = nodeIndexById[expandedMainId];
      if (mainIndex === undefined) return { nodes, links };

      const mainName =
        data.mainCategories.find((m) => m.id === expandedMainId)?.name ||
        "Kategorie";

      topSubs.forEach((sub) => {
        const subNodeId = sub.id;
        const subNodeIndex = nodes.length;
        nodeIndexById[subNodeId] = subNodeIndex;

        nodes.push({
          name: sub.name,
          id: subNodeId,
          type: "expense-sub",
          amount: sub.amount,
        });

        const value = Math.round(sub.amount);
        if (value > 0) {
          links.push({
            source: mainIndex,
            target: subNodeIndex,
            value,
            label: `${mainName} → ${sub.name}`,
          });
        }
      });

      if (restAmount > 0.01) {
        const restId = `__rest_${expandedMainId}`;
        const restIndex = nodes.length;
        nodeIndexById[restId] = restIndex;

        nodes.push({
          name: "Rest",
          id: restId,
          type: "expense-sub",
          amount: restAmount,
        });

        links.push({
          source: mainIndex,
          target: restIndex,
          value: Math.round(restAmount),
          label: `${mainName} → Rest`,
        });
      }
    }

    return { nodes, links };
  }, [data, expandedMainId, totalExpenses]);

  // Berechne optimale Mindestbreite basierend auf Node-Anzahl (mobile horizontal scroll)
  const minChartWidth = useMemo(() => {
    const nodeCount = sankeyData.nodes.length || 1;
    const avgNodeWidth = 90; // Durchschnittliche Node-Breite in px (mit Padding)
    return Math.max(nodeCount * avgNodeWidth, 640);
  }, [sankeyData.nodes.length]);

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

                const handleClick = () => {
                  if (!isMainCategory) return;
                  setExpandedMainId((current) =>
                    current === payload.id ? null : payload.id
                  );
                };

                // Farb-Logik: Kategorie-spezifische Farben wie im Sunburst
                let fillColor = "hsl(var(--chart-net))";
                if (payload.type === "income") {
                  fillColor = "hsl(var(--chart-income))"; // Mint für Einnahmen
                } else if (payload.type === "account") {
                  // Konten in ihrer eigenen Farbe (aus den Kontoeinstellungen)
                  fillColor = payload.color || "hsl(var(--chart-net))";
                } else if (payload.type === "expense-main") {
                  // Jede Hauptkategorie bekommt eigene Farbe aus der Palette
                  const mainIndex = data.mainCategories.findIndex((m) => m.id === payload.id);
                  fillColor = chartColorAt(mainIndex, data.mainCategories.length);
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
                      cursor: isMainCategory ? "pointer" : "default",
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}