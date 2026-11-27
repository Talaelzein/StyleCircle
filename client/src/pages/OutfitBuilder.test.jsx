import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OutfitBuilder from "./OutfitBuilder.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OutfitBuilder saved outfit regression", () => {
  it("renders saved clothing previews without crashing", async () => {
    const pieces = [
      { _id: "item-1", name: "White Shirt", category: "top", color: "White" },
      { _id: "item-2", name: "Blue Jeans", category: "bottom", color: "Blue" }
    ];
    const saved = [{
      _id: "outfit-1",
      name: "University Casual",
      occasion: "University",
      notes: "Comfortable",
      clothingItemIds: pieces
    }];

    vi.stubGlobal("fetch", vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => String(url).endsWith("/api/outfits")
        ? { outfits: saved }
        : { items: pieces }
    })));

    render(
      <MemoryRouter>
        <OutfitBuilder
          user={{ id: "507f1f77bcf86cd799439012", username: "Tester" }}
          token="test-token"
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("University Casual")).toBeInTheDocument();
    expect(screen.getByText("My Saved Outfits")).toBeInTheDocument();
    expect(screen.getAllByText("White Shirt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blue Jeans").length).toBeGreaterThan(0);
  });
});
