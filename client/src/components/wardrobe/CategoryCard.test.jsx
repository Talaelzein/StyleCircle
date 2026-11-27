import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CategoryCard from "./CategoryCard.jsx";

describe("Illustrated closet navigation", () => {
  it("uses the real wardrobe category route", () => {
    render(<MemoryRouter><CategoryCard category={{ key: "shoes", label: "Shoes", art: "shoes.webp", hint: "Your shoes" }} count={3} /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /Shoes/i });
    expect(link).toHaveAttribute("href", "/wardrobe/shoes");
    expect(screen.getByText("3 pieces")).toBeInTheDocument();
  });
});
