import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DeltaBadge from "../DeltaBadge";

describe("DeltaBadge", () => {
  it("sollte kleine Änderungen neutral (ohne Alarmfarbe) zeigen", () => {
    const { container } = render(<DeltaBadge current={103} previous={100} />);
    expect(screen.getByText("+3 %")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });

  it("sollte deutliche Verbesserung positiv einfärben", () => {
    const { container } = render(<DeltaBadge current={130} previous={100} />);
    expect(screen.getByText("+30 %")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-positive");
  });

  it("sollte deutlichen Rückgang beim Vermögen kritisch einfärben", () => {
    const { container } = render(<DeltaBadge current={70} previous={100} />);
    expect(screen.getByText("−30 %".replace("−", "-"))).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-destructive");
  });

  it("[Edge] sollte Vorwert 0 als 'neu' zeigen", () => {
    render(<DeltaBadge current={50} previous={0} />);
    expect(screen.getByText("neu")).toBeInTheDocument();
  });

  it("sollte absolute Formatierung unterstützen", () => {
    render(
      <DeltaBadge current={120} previous={100} format="absolute" formatAbsolute={(d) => `${d > 0 ? "+" : ""}${d} €`} />,
    );
    expect(screen.getByText("+20 €")).toBeInTheDocument();
  });
});
