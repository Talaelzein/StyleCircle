
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

// Build a URL for the clothing search and category filters.
export function wardrobeUrl(filters = {}) {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  const query = params.toString();

  return `${API_URL}/api/clothing-items${
    query ? `?${query}` : ""
  }`;
}

// Convert an API response to JavaScript data.
// Display an error when the server rejects the request.
export async function getResponseData(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// Base address of the Express backend.
export { API_URL };
