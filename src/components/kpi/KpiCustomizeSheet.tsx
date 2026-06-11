import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dyadProps } from "@/lib/dyad";
import { KPI_DEFINITIONS, type KpiId } from "@/components/kpi/kpis";

export type KpiPrefs = {
  order: KpiId[];
  active: KpiId[];
};

function normalizePrefs(prefs: KpiPrefs): KpiPrefs {
  const allIds = KPI_DEFINITIONS.map((k) => k.id);
  const order = Array.from(new Set([...(prefs.order || []), ...allIds])).filter((id) => allIds.includes(id));
  const active = Array.from(new Set(prefs.active || [])).filter((id) => allIds.includes(id));
  return { order, active };
}

function mergeActiveOrderIntoOrder(order: KpiId[], activeOrder: KpiId[]) {
  const rest = order.filter((id) => !activeOrder.includes(id));
  return [...activeOrder, ...rest];
}

function SortableRow({
  id,
  label,
  isActive,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  id: KpiId;
  label: string;
  isActive: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2",
        isDragging && "opacity-70"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          {...attributes}
          {...listeners}
          aria-label="Reihenfolge ändern"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <label className="flex min-w-0 items-center gap-3">
          <Checkbox checked={isActive} onCheckedChange={onToggle} />
          <span className="truncate text-sm">{label}</span>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMoveUp}
          aria-label="Nach oben"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMoveDown}
          aria-label="Nach unten"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function KpiCustomizeSheet({
  open,
  onOpenChange,
  value,
  onSave,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: KpiPrefs;
  onSave: (next: KpiPrefs) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<KpiPrefs>(() => normalizePrefs(value));

  useEffect(() => {
    if (!open) return;
    setDraft(normalizePrefs(value));
  }, [open, value]);

  const normalized = useMemo(() => normalizePrefs(draft), [draft]);

  const activeOrder = useMemo(
    () => normalized.order.filter((id) => normalized.active.includes(id)),
    [normalized.order, normalized.active]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const setActive = (id: KpiId, nextActive: boolean) => {
    setDraft((prev) => {
      const p = normalizePrefs(prev);
      const active = nextActive ? Array.from(new Set([...p.active, id])) : p.active.filter((x) => x !== id);
      const order = p.order.includes(id) ? p.order : [...p.order, id];
      return { order, active };
    });
  };

  const move = (id: KpiId, dir: -1 | 1) => {
    setDraft((prev) => {
      const p = normalizePrefs(prev);
      const a = p.order.filter((x) => p.active.includes(x));
      const from = a.indexOf(id);
      if (from < 0) return p;
      const to = Math.max(0, Math.min(a.length - 1, from + dir));
      if (from === to) return p;
      const nextA = arrayMove(a, from, to);
      return { ...p, order: mergeActiveOrderIntoOrder(p.order, nextA) };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraft((prev) => {
      const p = normalizePrefs(prev);
      const a = p.order.filter((x) => p.active.includes(x));
      const oldIndex = a.indexOf(active.id as KpiId);
      const newIndex = a.indexOf(over.id as KpiId);
      if (oldIndex < 0 || newIndex < 0) return p;
      const nextA = arrayMove(a, oldIndex, newIndex);
      return { ...p, order: mergeActiveOrderIntoOrder(p.order, nextA) };
    });
  };

  const activeCount = normalized.active.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent {...dyadProps("KpiCustomizeSheet")} className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dashboard anpassen</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Desktop zeigt maximal <span className="font-medium">3</span> KPIs, Mobile maximal <span className="font-medium">1</span>.
            {activeCount > 3 ? (
              <span className="ml-1">Du hast aktuell {activeCount} aktiv – die Anzeige wird gekürzt (Reihenfolge zählt).</span>
            ) : null}
          </div>
        </div>

        <Tabs defaultValue="active" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Aktiv</TabsTrigger>
            <TabsTrigger value="all">Alle</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card className="p-3">
              {activeOrder.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Keine KPIs aktiv.</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext items={activeOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {activeOrder.map((id) => {
                        const def = KPI_DEFINITIONS.find((k) => k.id === id);
                        if (!def) return null;
                        return (
                          <SortableRow
                            key={id}
                            id={id}
                            label={def.label}
                            isActive={true}
                            onToggle={() => setActive(id, false)}
                            onMoveUp={() => move(id, -1)}
                            onMoveDown={() => move(id, 1)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card className="p-3">
              <div className="space-y-2">
                {KPI_DEFINITIONS.map((def) => {
                  const checked = normalized.active.includes(def.id);
                  return (
                    <label
                      key={def.id}
                      className="flex cursor-pointer items-start justify-between gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={checked} onCheckedChange={() => setActive(def.id, !checked)} />
                          <span className="text-sm font-medium">{def.label}</span>
                        </div>
                        {def.description ? (
                          <div className="mt-1 text-xs text-muted-foreground">{def.description}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            Zurücksetzen
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(normalized);
              onOpenChange(false);
            }}
          >
            Speichern
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}