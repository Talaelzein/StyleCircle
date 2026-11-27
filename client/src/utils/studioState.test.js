import { describe, expect, it } from "vitest";
import { applySelectionRules, selectionSignature, buildDescription } from "./studioState.js";

const clothes = [
  { _id: "top1", category: "top", name: "White Shirt", color: "White" },
  { _id: "top2", category: "top", name: "Black Shirt", color: "Black" },
  { _id: "bottom1", category: "bottom", name: "Blue Jeans" },
  { _id: "dress1", category: "dress", name: "Red Dress" },
  { _id: "outer1", category: "outerwear", name: "Jacket" },
  { _id: "shoe1", category: "shoes", name: "Sneakers" }
];

describe("AI Style Studio selection rules", () => {
  it("allows one top and one bottom and replaces a top of the same category", () => {
    expect(applySelectionRules(["top1"], clothes[2], clothes)).toEqual(["top1", "bottom1"]);
    expect(applySelectionRules(["top1", "bottom1"], clothes[1], clothes)).toEqual(["bottom1", "top2"]);
  });

  it("replaces top and bottom when selecting a dress, preserving outerwear", () => {
    expect(applySelectionRules(["top1","bottom1","outer1"], clothes[3], clothes))
      .toEqual(["outer1","dress1"]);
  });

  it("does not select unsupported categories and toggles existing items", () => {
    expect(applySelectionRules(["top1"], clothes[5], clothes)).toEqual(["top1"]);
    expect(applySelectionRules(["top1"], clothes[0], clothes)).toEqual([]);
  });

  it("produces stable signatures and clear garment descriptions", () => {
    expect(selectionSignature(["B", "A"])).toBe(selectionSignature(["A","B"]));
    expect(buildDescription(clothes[0])).toBe("White White Shirt top");
  });
});
