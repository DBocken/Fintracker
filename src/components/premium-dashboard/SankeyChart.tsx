"use client";

import { useMemo, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Network } from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import jsPDF from "jspdf";

interface SankeyMainCategory {
  id: string;
  name: string;
  amount: number;
}

interface SankeySubCategory {
  id: string;
  name: string;
  amount: number;
  mainId: string;
  mainName: string;
}

interface SankeyChartProps {
  data: {
    totalIncome: number;
    mainCategories: SankeyMainCategory[];
    subCategories: SankeySubCategory[];
  };
}

export function SankeyChart({ data }: SankeyChartProps) {
  // Wenn keine Hauptkategorien vorhanden sind, macht das Diagramm keinen Sinn
  if (!data || !Array.isArray(data.mainCategories) || data.mainCategories.length === 0) {
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

  const [expandedMainId, setExpandedMainId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [percentMode, setPercentMode] = useState<boolean>(false);
  const [chartHeight, setChartHeight] = useState<number>(500);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const totalExpenses = useMemo(
    () => data.mainCategories.reduce((sum, m) => sum + (m.amount || 0), 0),
    [data.mainCategories]
  );

  const sankeyData = useMemo(() => {
    const nodes: {
      name: string;
      id: string;
      type?: string;
      amount?: number;
    }[] = [];

    const links: {
      source: number;
      target: number;
      value: number;
      label?: string;
    }[] = [];

    const nodeIndexById: Record<string, number> = {};

    // Einnahmen und Konto-Knoten abhängig vom Fokusmodus:
    // Im Fokusmodus (expandedMainId gesetzt) Einnahmen ausblenden, um Übersicht zu erhöhen.
    if (!expandedMainId) {
      nodes.push({
        name: "Einnahmen",
        id: "income",
        type: "income",
        amount: data.totalIncome,
      });
      nodeIndexById["income"] = nodes.length - 1;
    }

    // Konto-Knoten
    nodes.push({
      name: "Konto",
      id: "account",
      type: "middle",
    });
    nodeIndexById["account"] = nodes.length - 1;

    // Einnahmen → Konto nur, wenn Einnahmen-Knoten vorhanden ist
    if (!expandedMainId && data.totalIncome > 0) {
      links.push({
        source: nodeIndexById["income"],
        target: nodeIndexById["account"],
        value: Math.round(data.totalIncome),
        label: "Einnahmen → Konto",
      });
    }

    // Konto → Hauptkategorien (Fokus: nur die expandierte Hauptkategorie anzeigen)
    const mainsToShow = expandedMainId
      ? data.mainCategories.filter((m) => m.id === expandedMainId)
      : data.mainCategories;

    mainsToShow.forEach((main) => {
      const nodeId = main.id;
      const nodeIndex = nodes.length;
      nodeIndexById[nodeId] = nodeIndex;

      nodes.push({
        name: main.name,
        id: nodeId,
        type: "expense-main",
        amount: main.amount,
      });

      const value = Math.round(main.amount);
      if (value > 0) {
        links.push({
          source: nodeIndexById["account"],
          target: nodeIndex,
          value,
          label: `Konto → ${main.name}`,
        });
      }
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
  }, [data, expandedMainId]);

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
    } else if (type === "expense-main" || type === "expense-sub") {
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
    const dataUrl = await toPng(containerRef.current, { cacheBust: true, backgroundColor: "#ffffff" });
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
          Zeigt den Fluss von Einnahmen (links) über dein Konto zu
          Ausgabenkategorien. Klicke auf eine Kategorie, um die
          Unterkategorien einzublenden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Steuerleiste */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={percentMode} onCheckedChange={(v) => setPercentMode(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Prozentwerte</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Höhe:</span>
              <Slider
                value={[chartHeight]}
                min={300}
                max={800}
                step={20}
                onValueChange={(vals) => setChartHeight(vals[0] || 500)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">{chartHeight}px</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExportPNG}>Export PNG</Button>
            <Button size="sm" variant="outline" onClick={handleExportJPEG}>Export JPEG</Button>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>Export PDF</Button>
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

        <div ref={containerRef} style={{ height: `${chartHeight}px` }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              nodePadding={40}
              margin={{ top: 20, right: 40, bottom: 20, left: 20 }}
              link={{ stroke: "#94a3b8", strokeOpacity: 0.5 }}
              node={({ x, y, width, height, payload }: any) => {
                const rectHeight = Math.max(height, 20);
                const isMainCategory = data.mainCategories.some(
                  (main) => main.id === payload.id
                );
                const isExpanded = expandedMainId === payload.id;

                const handleClick = () => {
                  if (!isMainCategory) return;
                  setExpandedMainId((current) =>
                    current === payload.id ? null : payload.id
                  );
                };

                const fillColor =
                  payload.type === "income"
                    ? "#10b981"
                    : payload.type === "expense-main"
                    ? isExpanded
                      ? "#f97316"
                      : "#3b82f6"
                    : payload.type === "expense-sub"
                    ? "#ef4444"
                    : "#3b82f6";

                const amountLabel = formatAmount(payload.type, payload.amount);

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
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={rectHeight}
                      fill={fillColor}
                      stroke="#fff"
                      strokeWidth={2}
                      rx={4}
                    />
                    <text
                      x={x + width / 2}
                      y={y + rectHeight / 2}
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
                        y={y + rectHeight / 2 + 15}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={10}
                      >
                        {amountLabel}
                      </text>
                    )}
                  </g>
                );
              }}
            >
              <Tooltip
                formatter={(value: number) => [
                  value.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  }),
                  "",
                ]}
                labelFormatter={(label) => `Fluss: ${label}`}
              />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}