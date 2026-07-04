import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTree } from "../CategoryTree";
import type { HierarchicalCategory } from "../../../types";

function makeCategory(partial: Partial<HierarchicalCategory> & { id: string; name: string }): HierarchicalCategory {
  return {
    icon: "🏠",
    filters: [],
    parent_id: null,
    is_default: false,
    ...partial,
  };
}

function renderTree(categories: HierarchicalCategory[], expanded: Set<string> = new Set()) {
  const handlers = {
    onToggleExpand: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAddSubcategory: vi.fn(),
  };
  render(
    <CategoryTree
      categories={categories}
      expandedCategories={expanded}
      {...handlers}
    />,
  );
  return handlers;
}

describe("CategoryTree Aktions-Buttons A11y", () => {
  describe("Normal Behavior", () => {
    it("sollte alle Aktions-Buttons mit deutschem aria-label als zugänglichem Namen anbieten", () => {
      renderTree([makeCategory({ id: "cat-1", name: "Wohnen" })]);

      const anlegen = screen.getByRole("button", { name: "Unterkategorie erstellen" });
      const bearbeiten = screen.getByRole("button", { name: "Bearbeiten" });
      const loeschen = screen.getByRole("button", { name: "Löschen" });

      // aria-label muss explizit gesetzt sein (title bleibt nur als Tooltip).
      expect(anlegen).toHaveAttribute("aria-label", "Unterkategorie erstellen");
      expect(bearbeiten).toHaveAttribute("aria-label", "Bearbeiten");
      expect(loeschen).toHaveAttribute("aria-label", "Löschen");
    });

    it("sollte den title als Tooltip zusätzlich behalten", () => {
      renderTree([makeCategory({ id: "cat-1", name: "Wohnen" })]);

      expect(screen.getByRole("button", { name: "Bearbeiten" })).toHaveAttribute("title", "Bearbeiten");
    });
  });

  describe("Edge Cases", () => {
    it("sollte für Default-Kategorien keinen Löschen-Button anzeigen", () => {
      renderTree([makeCategory({ id: "cat-default", name: "Sonstiges", is_default: true })]);

      expect(screen.queryByRole("button", { name: "Löschen" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Bearbeiten" })).toBeInTheDocument();
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte den Auf-/Zuklapp-Button weiterhin mit aria-label benennen", () => {
      const child = makeCategory({ id: "cat-sub", name: "Miete", parent_id: "cat-1" });
      renderTree([makeCategory({ id: "cat-1", name: "Wohnen", children: [child] })]);

      expect(screen.getByRole("button", { name: "Ausklappen" })).toBeInTheDocument();
    });
  });
});
