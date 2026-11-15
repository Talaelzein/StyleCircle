
import {
  describe,
  expect,
  it
} from "vitest";

import {
  suggestOutfits
} from "./outfitMatcher.js";

const item = (id, category, extra = {}) => ({
  _id: id,
  name: `${category} ${id}`,
  category,
  ...extra
});

describe("Smart Mix & Match", () => {
  it("returns no suggestions for an empty closet", () => {
    expect(
      suggestOutfits([])
    ).toEqual([]);
  });

  it("combines tops, bottoms, and shoes", () => {
    const clothes = [
      item("top1", "top"),
      item("bottom1", "bottom"),
      item("shoe1", "shoes")
    ];

    const suggestions = suggestOutfits(clothes);

    expect(suggestions).toHaveLength(2);

    expect(
      suggestions.some(
        (suggestion) =>
          suggestion.items.length === 2
      )
    ).toBe(true);

    expect(
      suggestions.some(
        (suggestion) =>
          suggestion.items.length === 3
      )
    ).toBe(true);
  });

  it("ranks matching styles and occasions higher", () => {
    const clothes = [
      item("casualTop", "top", {
        style: "Casual",
        occasion: "University"
      }),

      item("formalTop", "top", {
        style: "Formal",
        occasion: "Office"
      }),

      item("jeans", "bottom", {
        style: "Casual",
        occasion: "University"
      })
    ];

    const suggestions = suggestOutfits(
      clothes,
      {
        style: "Casual",
        occasion: "University"
      }
    );

    expect(
      suggestions[0].clothingItemIds
    ).toEqual([
      "casualTop",
      "jeans"
    ]);
  });
});
