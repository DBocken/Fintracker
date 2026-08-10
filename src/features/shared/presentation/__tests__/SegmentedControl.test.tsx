import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "../SegmentedControl";

const OPTIONS = [
  { value: "daily", label: "Tag" },
  { value: "weekly", label: "Woche" },
  { value: "monthly", label: "Monat" },
] as const;

describe("SegmentedControl", () => {
  describe("Normal Behavior", () => {
    it("sollte alle Optionen als Tabs in einer beschrifteten Tablist rendern", () => {
      render(
        <SegmentedControl aria-label="Zeitraum" options={[...OPTIONS]} value="daily" onValueChange={vi.fn()} />,
      );
      expect(screen.getByRole("tablist", { name: "Zeitraum" })).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
    });

    it("sollte die aktive Option als aria-selected markieren", () => {
      render(
        <SegmentedControl aria-label="Zeitraum" options={[...OPTIONS]} value="weekly" onValueChange={vi.fn()} />,
      );
      expect(screen.getByRole("tab", { name: "Woche" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "Tag" })).toHaveAttribute("aria-selected", "false");
    });

    it("sollte onValueChange mit dem Wert des angetippten Segments aufrufen", () => {
      const onValueChange = vi.fn();
      render(
        <SegmentedControl aria-label="Zeitraum" options={[...OPTIONS]} value="daily" onValueChange={onValueChange} />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Monat" }));
      expect(onValueChange).toHaveBeenCalledWith("monthly");
    });
  });

  describe("Edge Cases", () => {
    it("sollte mit einer einzelnen Option umgehen", () => {
      render(
        <SegmentedControl aria-label="Auswahl" options={[{ value: "only", label: "Einzig" }]} value="only" onValueChange={vi.fn()} />,
      );
      expect(screen.getAllByRole("tab")).toHaveLength(1);
    });
  });
});
