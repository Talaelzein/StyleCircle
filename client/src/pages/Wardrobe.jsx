
import { useEffect, useState } from "react";
import {
  API_URL,
  wardrobeUrl,
  getResponseData
} from "../services/api";

import ClothingFields from "../components/ClothingFields.jsx";
import ClothingPhoto from "../components/ClothingPhoto.jsx";

const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory"
];

const EMPTY_CLOTHING = {
  name: "",
  category: "top",
  color: "",
  material: "",
  style: "",
  occasion: "",
  season: ""
};

export default function Wardrobe({ user, token, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addForm, setAddForm] = useState({
    ...EMPTY_CLOTHING
  });
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    ...EMPTY_CLOTHING
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    search: "",
    category: ""
  });

  function handleFilterSubmit(event) {
    event.preventDefault();

    setActiveFilters({
      search: searchText.trim(),
      category: categoryFilter
    });
  }

  function clearFilters() {
    setSearchText("");
    setCategoryFilter("");
    setActiveFilters({
      search: "",
      category: ""
    });
  }

  // Load clothing items from the backend.
  useEffect(() => {
    const controller = new AbortController();

    async function loadItems() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          wardrobeUrl(activeFilters),
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        const data = await getResponseData(response);

        if (!controller.signal.aborted) {
          setItems(data.items);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadItems();

    return () => controller.abort();
  }, [token, activeFilters]);

  // Refresh wardrobe after adding or editing clothes.
  async function refreshWardrobe() {
    const response = await fetch(
      wardrobeUrl(activeFilters),
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await getResponseData(response);
    setItems(data.items);
  }

  function changeAddForm(event) {
    const { name, value } = event.target;

    setAddForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function changeEditForm(event) {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  // Add clothing item.
  async function handleAddClothing(event) {
    event.preventDefault();

    setAdding(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/clothing-items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(addForm)
        }
      );

      await getResponseData(response);
      await refreshWardrobe();

      setAddForm({ ...EMPTY_CLOTHING });
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  // Start editing an existing item.
  function startEditing(item) {
    setEditingId(item._id);
    setError("");

    setEditForm({
      name: item.name || "",
      category: item.category || "top",
      color: item.color || "",
      material: item.material || "",
      style: item.style || "",
      occasion: item.occasion || "",
      season: item.season || ""
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ ...EMPTY_CLOTHING });
  }

  // Save changes.
  async function handleUpdateClothing(event) {
    event.preventDefault();

    if (!editingId) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/clothing-items/${editingId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(editForm)
        }
      );

      await getResponseData(response);
      await refreshWardrobe();

      cancelEditing();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Delete clothing item.
  async function handleDeleteClothing(id) {
    if (!window.confirm("Delete this clothing item?")) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/clothing-items/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Could not delete clothing item");
      }

      setItems((previous) =>
        previous.filter((item) => item._id !== id)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="shell">
      <h1>
        Style<span>Circle</span>
      </h1>

      <div className="panel">
        <h2>{user.username}'s Closet</h2>
        <p>Organize your personal wardrobe.</p>

        <h3>Add a Clothing Item</h3>

        <form
          className="auth-form"
          onSubmit={handleAddClothing}
        >
          <ClothingFields
            form={addForm}
            onChange={changeAddForm}
            categories={CATEGORIES}
          />

          <button type="submit" disabled={adding}>
            {adding ? "Adding..." : "+ Add Clothing"}
          </button>
        </form>

        <hr />

        <h3>Search My Closet</h3>

        <form
          className="auth-form"
          onSubmit={handleFilterSubmit}
        >
          <label className="closet-field">
            Search by clothing name
            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="e.g. shirt"
              maxLength={80}
            />
          </label>

          <label className="closet-field">
            Category
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
            >
              <option value="">All categories</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() +
                    category.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">Search</button>

          <button
            type="button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </form>

        <h3>My Clothing Items</h3>

        {loading && (
          <p>Loading your clothes...</p>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!loading &&
          items.length === 0 &&
          !error && (
            <p>
              {activeFilters.search ||
              activeFilters.category
                ? "No clothing items match your filters."
                : "Your closet is empty. Add your first item!"}
            </p>
          )}

        {!loading &&
          items.map((item) => (
            <div
              className="clothing-card"
              key={item._id}
            >
              {editingId === item._id ? (
                <form
                  className="auth-form"
                  onSubmit={handleUpdateClothing}
                >
                  <h3>Edit Clothing</h3>

                  <ClothingFields
                    form={editForm}
                    onChange={changeEditForm}
                    categories={CATEGORIES}
                  />

                  <button
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <h3>{item.name}</h3>

                  {/* CLOTHING PHOTO UPLOAD */}
                  <ClothingPhoto
                    item={item}
                    token={token}
                  />

                  <p>
                    Category: {item.category}
                  </p>

                  <p>
                    Color:{" "}
                    {item.color || "Not specified"}
                  </p>

                  <p>
                    Material:{" "}
                    {item.material || "Not specified"}
                  </p>

                  <p>
                    Style:{" "}
                    {item.style || "Not specified"}
                  </p>

                  <p>
                    Occasion:{" "}
                    {item.occasion || "Not specified"}
                  </p>

                  <p>
                    Season:{" "}
                    {item.season || "Not specified"}
                  </p>

                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                  >
                    Edit
                  </button>

                  {" "}

                  <button
                    type="button"
                    disabled={
                      deletingId === item._id
                    }
                    onClick={() =>
                      handleDeleteClothing(item._id)
                    }
                  >
                    {deletingId === item._id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </>
              )}
            </div>
          ))}

        <hr />

        <button
          type="button"
          onClick={onLogout}
        >
          Log Out
        </button>
      </div>
    </main>
  );
}
