import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatHero from "../StatHero";
import SectionHeader from "../SectionHeader";

describe("StatHero", () => {
  it("sollte Label und Kennzahl anzeigen", () => {
    render(<StatHero label="Aktueller Kontostand" value="2.408,45 €" />);
    expect(screen.getByText("Aktueller Kontostand")).toBeInTheDocument();
    expect(screen.getByText("2.408,45 €")).toBeInTheDocument();
  });

  it("sollte Badge und Bildunterschrift rendern, wenn angegeben", () => {
    render(<StatHero label="Saldo" value="100 €" badge={<span>+5%</span>} caption="im Zeitraum" />);
    expect(screen.getByText("+5%")).toBeInTheDocument();
    expect(screen.getByText("im Zeitraum")).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  it("sollte den Titel als Überschrift rendern", () => {
    render(<SectionHeader title="Letzte Buchungen" />);
    expect(screen.getByRole("heading", { name: "Letzte Buchungen" })).toBeInTheDocument();
  });

  it("sollte eine optionale Aktion rendern", () => {
    render(<SectionHeader title="Meilensteine" action={<a href="/milestones">Alle anzeigen</a>} />);
    expect(screen.getByRole("link", { name: "Alle anzeigen" })).toBeInTheDocument();
  });
});
