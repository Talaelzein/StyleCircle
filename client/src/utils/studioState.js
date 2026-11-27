export const MAX_PHOTO = 15 * 1024 * 1024;
export const TYPES = ["image/jpeg", "image/png", "image/webp"];
export const SUPPORTED_CATEGORIES = new Set([
  "top",
  "outerwear",
  "bottom",
  "dress"
]);

export function accountId(token) {
  try {
    const payload = JSON.parse(
      atob(
        token.split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/")
      )
    );

    return String(
      payload.sub || payload.userId || payload.id || "local"
    ).slice(0, 100);
  } catch {
    return "local";
  }
}

export function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("stylecircle-studio-v1", 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("photos")) {
        request.result.createObjectStore("photos");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storage(action, key, blob) {
  const db = await openPhotoDB();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        "photos",
        action === "get" ? "readonly" : "readwrite"
      );

      const store = transaction.objectStore("photos");

      const request =
        action === "put"
          ? store.put(blob, key)
          : action === "delete"
            ? store.delete(key)
            : store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function initialSelectionList(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    return Array.isArray(data.picked)
      ? data.picked.map(String)
      : [];
  } catch {
    return [];
  }
}

export function selectionSignature(ids) {
  return ids
    .map(String)
    .slice()
    .sort()
    .join("|");
}

export function normalizeCategory(category) {
  return String(category || "").toLowerCase();
}

export function buildDescription(item) {
  return [
    item.color,
    item.name,
    item.category
  ].filter(Boolean).join(" ");
}

export function applySelectionRules(currentIds, clickedItem, clothes) {
  const id = String(clickedItem._id);
  const category = normalizeCategory(clickedItem.category);

  if (!SUPPORTED_CATEGORIES.has(category)) {
    return currentIds;
  }

  if (currentIds.includes(id)) {
    return currentIds.filter(existingId => existingId !== id);
  }

  const currentItems = currentIds
    .map(existingId =>
      clothes.find(piece => String(piece._id) === String(existingId))
    )
    .filter(Boolean);

  const kept = currentItems.filter(piece => {
    const pieceCategory = normalizeCategory(piece.category);

    if (pieceCategory === category) {
      return false;
    }

    if (category === "dress" && (pieceCategory === "top" || pieceCategory === "bottom")) {
      return false;
    }

    if ((category === "top" || category === "bottom") && pieceCategory === "dress") {
      return false;
    }

    return true;
  });

  return [...kept.map(piece => String(piece._id)), id];
}

