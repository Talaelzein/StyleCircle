
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  API_URL,
  getResponseData
} from "../services/api";

const EMPTY_FORM = {
  name: "",
  occasion: "",
  notes: "",
  clothingItemIds: []
};

export default function OutfitBuilder({
  user,
  token,
  onLogout
}) {
  const [clothes, setClothes] = useState([]);
  const [outfits, setOutfits] = useState([]);

  const [form, setForm] = useState({
    ...EMPTY_FORM
  });

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load the user's clothing items and saved outfits.
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const [clothingResponse, outfitResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/clothing-items`, {
              headers,
              signal: controller.signal
            }),

            fetch(`${API_URL}/api/outfits`, {
              headers,
              signal: controller.signal
            })
          ]);

        const [clothingData, outfitData] =
          await Promise.all([
            getResponseData(clothingResponse),
            getResponseData(outfitResponse)
          ]);

        if (!controller.signal.aborted) {
          setClothes(clothingData.items);
          setOutfits(outfitData.outfits);
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

    loadData();

    return () => {
      controller.abort();
    };
  }, [token]);

  // Update name, occasion, or notes.
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  // Select or unselect a clothing item.
  function toggleClothing(id) {
    setError("");
    setMessage("");

    setForm((previous) => {
      const selected = previous.clothingItemIds;

      if (selected.includes(id)) {
        return {
          ...previous,
          clothingItemIds: selected.filter(
            (itemId) => itemId !== id
          )
        };
      }

      if (selected.length >= 10) {
        return previous;
      }

      return {
        ...previous,
        clothingItemIds: [...selected, id]
      };
    });
  }

  // Reset the form after saving or canceling.
  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      clothingItemIds: []
    });

    setEditingId(null);
  }

  // Save a new outfit or update an existing one.
  async function handleSave(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("Please enter an outfit name.");
      return;
    }

    if (
      form.clothingItemIds.length < 2 ||
      form.clothingItemIds.length > 10
    ) {
      setError(
        "Choose between 2 and 10 clothing items."
      );
      return;
    }

    setSaving(true);

    try {
      const isEditing = Boolean(editingId);

      const url = isEditing
        ? `${API_URL}/api/outfits/${editingId}`
        : `${API_URL}/api/outfits`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          occasion: form.occasion.trim(),
          notes: form.notes.trim(),
          clothingItemIds: form.clothingItemIds
        })
      });

      const data = await getResponseData(response);

      if (isEditing) {
        setOutfits((previous) =>
          previous.map((outfit) =>
            outfit._id === editingId
              ? data.outfit
              : outfit
          )
        );
      } else {
        setOutfits((previous) => [
          data.outfit,
          ...previous
        ]);
      }

      resetForm();

      setMessage(
        isEditing
          ? "Outfit updated successfully!"
          : "Outfit saved successfully!"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Load an existing outfit into the form.
  function handleEdit(outfit) {
    const availableIds = new Set(
      clothes.map((item) => item._id)
    );

    const selectedIds = (
      outfit.clothingItemIds || []
    )
      .filter(Boolean)
      .map((item) =>
        typeof item === "string"
          ? item
          : item._id
      )
      .filter((id) => availableIds.has(id));

    setForm({
      name: outfit.name || "",
      occasion: outfit.occasion || "",
      notes: outfit.notes || "",
      clothingItemIds: selectedIds
    });

    setEditingId(outfit._id);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // Delete a saved outfit.
  async function handleDelete(id) {
    if (
      !window.confirm(
        "Are you sure you want to delete this outfit?"
      )
    ) {
      return;
    }

    setDeletingId(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/outfits/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        await getResponseData(response);
      }

      setOutfits((previous) =>
        previous.filter(
          (outfit) => outfit._id !== id
        )
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage("Outfit deleted successfully.");
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
        <h2>Outfit Builder 👗</h2>

        <p>
          Welcome, {user?.username || "fashion lover"}!
        </p>

        <p>
          Create your perfect look using clothes
          from your wardrobe.
        </p>

        <nav style={{ marginBottom: "20px" }}>
          <Link to="/wardrobe">
            ← Back to My Closet
          </Link>
        </nav>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p>Loading your wardrobe and outfits...</p>
        ) : (
          <>
            <h3>
              {editingId
                ? "Edit Outfit"
                : "Create a New Outfit"}
            </h3>

            <form
              className="auth-form"
              onSubmit={handleSave}
            >
              <label>
                Outfit Name
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. University Casual"
                  maxLength={80}
                  required
                />
              </label>

              <label>
                Occasion
                <input
                  type="text"
                  name="occasion"
                  value={form.occasion}
                  onChange={handleChange}
                  placeholder="e.g. University, Party, Dinner"
                  maxLength={60}
                />
              </label>

              <label>
                Notes
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Describe your outfit..."
                  maxLength={300}
                  rows={3}
                />
              </label>

              <h3>Select Your Clothes</h3>

              <p>
                Selected:{" "}
                {form.clothingItemIds.length}/10
                {" "}(minimum 2)
              </p>

              {clothes.length < 2 && (
                <p>
                  You need at least two clothing
                  items to create an outfit.
                  {" "}
                  <Link to="/wardrobe">
                    Add clothes to My Closet
                  </Link>
                </p>
              )}

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginBottom: "20px"
                }}
              >
                {clothes.map((item) => {
                  const selected =
                    form.clothingItemIds.includes(
                      item._id
                    );

                  const disabled =
                    !selected &&
                    form.clothingItemIds.length >= 10;

                  return (
                    <label
                      key={item._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        border: selected
                          ? "2px solid #7c3aed"
                          : "1px solid #ddd",
                        borderRadius: "10px",
                        cursor: disabled
                          ? "not-allowed"
                          : "pointer",
                        opacity: disabled ? 0.6 : 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() =>
                          toggleClothing(item._id)
                        }
                      />

                      <span>
                        <strong>{item.name}</strong>
                        {" — "}
                        {item.category}
                        {item.color
                          ? ` — ${item.color}`
                          : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  form.clothingItemIds.length < 2
                }
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Outfit"
                    : "Save Outfit"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel Editing
                </button>
              )}
            </form>

            <hr />

            <h2>My Saved Outfits</h2>

            {outfits.length === 0 ? (
              <p>
                You haven't saved any outfits yet.
              </p>
            ) : (
              <div>
                {outfits.map((outfit) => (
                  <div
                    className="clothing-card"
                    key={outfit._id}
                  >
                    <h3>{outfit.name}</h3>

                    <p>
                      <strong>Occasion:</strong>{" "}
                      {outfit.occasion ||
                        "Not specified"}
                    </p>

                    {outfit.notes && (
                      <p>
                        <strong>Notes:</strong>{" "}
                        {outfit.notes}
                      </p>
                    )}

                    <h4>Clothing Pieces</h4>

                    <ul>
                      {(
                        outfit.clothingItemIds || []
                      )
                        .filter(Boolean)
                        .map((item) => (
                          <li key={item._id}>
                            {item.name} —{" "}
                            {item.category}
                          </li>
                        ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(outfit)
                      }
                    >
                      Edit
                    </button>

                    {" "}

                    <button
                      type="button"
                      disabled={
                        deletingId === outfit._id
                      }
                      onClick={() =>
                        handleDelete(outfit._id)
                      }
                    >
                      {deletingId === outfit._id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

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
