
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

const NEUTRAL_COLORS = [
  "white",
  "black",
  "gray",
  "grey",
  "beige",
  "cream",
  "navy",
  "brown",
  "denim"
];

function isNeutral(color) {
  const value = normalize(color);

  return NEUTRAL_COLORS.some(
    (neutral) => value.includes(neutral)
  );
}

// Give a score to two clothing colors.
function colorScore(firstColor, secondColor) {
  const first = normalize(firstColor);
  const second = normalize(secondColor);

  if (!first || !second) {
    return 1;
  }

  // Matching colors
  if (first === second) {
    return 3;
  }

  // Neutral colors usually combine easily.
  if (isNeutral(first) || isNeutral(second)) {
    return 3;
  }

  const matchingPairs = [
    ["blue", "orange"],
    ["red", "green"],
    ["purple", "yellow"],
    ["pink", "brown"],
    ["blue", "beige"]
  ];

  const complementary = matchingPairs.some(
    ([colorA, colorB]) =>
      (first.includes(colorA) &&
        second.includes(colorB)) ||
      (first.includes(colorB) &&
        second.includes(colorA))
  );

  if (complementary) {
    return 3;
  }

  return 1;
}

// Compare optional clothing metadata.
function matchingAttribute(first, second, field) {
  const valueA = normalize(first[field]);
  const valueB = normalize(second[field]);

  if (!valueA || !valueB) {
    return 0;
  }

  return valueA === valueB ? 2 : 0;
}

// Give a higher score to clothes that fit the
// user's selected occasion, season, or style.
function preferenceScore(items, preferences) {
  let score = 0;

  for (const item of items) {
    for (const field of [
      "occasion",
      "season",
      "style"
    ]) {
      const requested = normalize(
        preferences[field]
      );

      const actual = normalize(item[field]);

      if (
        requested &&
        actual &&
        actual === requested
      ) {
        score += 3;
      }
    }
  }

  return score;
}

// Evaluate one possible outfit.
function evaluateOutfit(items, preferences) {
  let score = 0;
  const reasons = [];

  // Compare colors across the outfit.
  for (let i = 0; i < items.length; i++) {
    for (
      let j = i + 1;
      j < items.length;
      j++
    ) {
      score += colorScore(
        items[i].color,
        items[j].color
      );

      score += matchingAttribute(
        items[i],
        items[j],
        "style"
      );

      score += matchingAttribute(
        items[i],
        items[j],
        "season"
      );

      score += matchingAttribute(
        items[i],
        items[j],
        "occasion"
      );
    }
  }

  score += preferenceScore(
    items,
    preferences
  );

  if (
    items.some((item) =>
      isNeutral(item.color)
    )
  ) {
    reasons.push(
      "Includes versatile neutral colors"
    );
  }

  if (
    items.every(
      (item) =>
        normalize(item.style) ===
          normalize(items[0].style)
    ) &&
    normalize(items[0].style)
  ) {
    reasons.push(
      "Clothing pieces share a similar style"
    );
  }

  if (
    preferences.occasion ||
    preferences.season ||
    preferences.style
  ) {
    reasons.push(
      "Ranked using your selected preferences"
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "Combines complementary clothing categories"
    );
  }

  return {
    score,
    reason: reasons.join(". ")
  };
}

// Main recommendation function.
export function suggestOutfits(
  clothingItems,
  preferences = {}
) {
  if (
    !Array.isArray(clothingItems) ||
    clothingItems.length < 2
  ) {
    return [];
  }

  const tops = clothingItems.filter(
    (item) => item.category === "top"
  );

  const bottoms = clothingItems.filter(
    (item) => item.category === "bottom"
  );

  const dresses = clothingItems.filter(
    (item) => item.category === "dress"
  );

  const shoes = clothingItems.filter(
    (item) => item.category === "shoes"
  );

  const outerwear = clothingItems.filter(
    (item) => item.category === "outerwear"
  );

  const combinations = [];

  // A top and bottom make a basic outfit.
  for (const top of tops) {
    for (const bottom of bottoms) {
      combinations.push([top, bottom]);

      // Suggest complete looks with shoes.
      for (const shoe of shoes) {
        combinations.push([
          top,
          bottom,
          shoe
        ]);
      }
    }
  }

  // A dress can be combined with shoes.
  for (const dress of dresses) {
    for (const shoe of shoes) {
      combinations.push([
        dress,
        shoe
      ]);
    }

    // Or with outerwear.
    for (const jacket of outerwear) {
      combinations.push([
        dress,
        jacket
      ]);
    }
  }

  // Score every combination.
  const suggestions = combinations.map(
    (items) => {
      const evaluation = evaluateOutfit(
        items,
        preferences
      );

      return {
        clothingItemIds: items.map(
          (item) => String(item._id)
        ),

        items: items.map((item) => ({
          _id: String(item._id),
          name: item.name,
          category: item.category,
          color: item.color || ""
        })),

        score: evaluation.score,
        reason: evaluation.reason
      };
    }
  );

  // Best matching outfits first.
  suggestions.sort(
    (a, b) => b.score - a.score
  );

  // Return at most five outfit suggestions.
  return suggestions.slice(0, 5);
}
