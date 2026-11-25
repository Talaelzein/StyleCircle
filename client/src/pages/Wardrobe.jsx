
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CategoryCard from "../components/wardrobe/CategoryCard.jsx";
import { closetCategories, illustrationUrl } from "../data/categories.js";
import { API_URL, wardrobeUrl,getResponseData } from "../services/api";

import ClothingFields from "../components/ClothingFields.jsx";
import ClothingPhoto from "../components/ClothingPhoto.jsx";
import useDraftState from "../hooks/useDraftState.js";
import "../styles/collections.css";

const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
  "jewelry",
  "glasses"
];

const EMPTY_CLOTHING = {
  name: "",
  category: "top",
  color: "",
  material: "",
  style: "",
  occasion: "",
  season: "", brand:"", size:"", price:0, purchaseDate:"", favorite:false, sourceUrl:"", imageUrl:""
};

export default function Wardrobe({ user, token, onLogout }) {
  const { category: categorySlug } = useParams();
  const selectedCategory = closetCategories.find((entry) => entry.key === categorySlug);
  const addPanelRef = useRef(null);
  const draft=`stylecircle-draft:${user.id}:wardrobe`;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addForm, setAddForm] = useDraftState(`${draft}:addForm`,{...EMPTY_CLOTHING});
  const [addPanelOpen,setAddPanelOpen]=useDraftState(`${draft}:addPanelOpen`,false);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useDraftState(`${draft}:editingId`,null);
  const [editForm, setEditForm] = useDraftState(`${draft}:editForm`,{...EMPTY_CLOTHING});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useDraftState(`${draft}:searchText`,"");
  const [categoryFilter, setCategoryFilter] = useDraftState(`${draft}:categoryFilter`,"");
  useEffect(() => {
    if (categorySlug) setAddForm((previous) => ({ ...previous, category: categorySlug }));
  }, [categorySlug]);

  function openAddPanel() {
    if (!addPanelRef.current) return;
    addPanelRef.current.open = true;
    setAddPanelOpen(true);
    addPanelRef.current.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const [activeFilters, setActiveFilters] = useDraftState(`${draft}:filters`,{
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
          wardrobeUrl({ ...activeFilters, category: categorySlug || activeFilters.category }),
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
  }, [token, activeFilters, categorySlug]);

  // Refresh wardrobe after adding or editing clothes.
  async function refreshWardrobe() {
    const response = await fetch(
      wardrobeUrl({ ...activeFilters, category: categorySlug || activeFilters.category }),
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
    const { name } = event.target;
    const value = name==="favorite" ? event.target.checked : name==="price" ? Number(event.target.value)||0 : event.target.value;

    setAddForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function changeEditForm(event) {
    const { name } = event.target;
    const value = name==="favorite" ? event.target.checked : name==="price" ? Number(event.target.value)||0 : event.target.value;

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

      setAddForm({ ...EMPTY_CLOTHING, category: categorySlug || "top" });
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
      season: item.season || "", brand:item.brand||"",size:item.size||"", price:item.price||0,
      purchaseDate:item.purchaseDate||"", favorite:Boolean(item.favorite),sourceUrl:item.sourceUrl||"", imageUrl:item.imageUrl||""
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

  const filteredItems = Array.isArray(items) ? items : [];
  const cardCounts = Object.fromEntries(CATEGORIES.map((key) => [key, filteredItems.filter((item) => item.category === key).length]));
  if (categorySlug && !selectedCategory) return (
    <main className="editorial-page"><Link to="/wardrobe" className="text-link">← Back to My Closet</Link><h1>Category not found.</h1></main>
  );

  return (
    <main className="editorial-page wardrobe-page">
      {!categorySlug ? (
        <>
          <section className="page-heading">
            <div>
              <p className="eyebrow">MY CLOSET</p>
              <h1>Browse Your Closet</h1>
              <p>Your personal wardrobe, organized your way. Start with an illustration, discover the real pieces inside.</p>
            </div>
            <button type="button" onClick={openAddPanel} className="button-primary">+ Add an Item</button>
          </section>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="wardrobe-category-grid">
            {closetCategories.map((category) => (
              <CategoryCard key={category.key} category={category} count={!loading ? cardCounts[category.key] : undefined} />
            ))}
          </div>
        </>
      ) : (
        <>
          <Link to="/wardrobe" className="text-link back-link">← All categories</Link>
          <section className="category-detail-heading">
            <img src={illustrationUrl(selectedCategory.art)} alt="" />
            <div>
              <p className="eyebrow">MY CLOSET / {selectedCategory.label.toUpperCase()}</p>
              <h1>{selectedCategory.label}</h1>
              <p>All your pieces in one place. Browse, upload photos, and create your next look.</p>
              <button type="button" onClick={openAddPanel} className="button-outline">+ Add to this collection</button>
            </div>
          </section>
          <section className="wardrobe-items-section" aria-label={`${selectedCategory.label} clothing items`}>
            <div className="section-heading">
              <div><p className="eyebrow">YOUR PERSONAL COLLECTION</p><h2>{loading ? "Loading your pieces…" : `${filteredItems.length} piece${filteredItems.length === 1 ? "" : "s"}`}</h2></div>
              <Link to="/outfits" className="button-outline">Build an Outfit →</Link>
            </div>
            <form className="wardrobe-filter-bar" onSubmit={handleFilterSubmit}>
              <label htmlFor="wardrobe-search">Search clothes</label>
              <input id="wardrobe-search" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by name…" maxLength={80} />
              <button type="submit" className="button-primary">Search</button>
              <button type="button" className="button-outline" onClick={clearFilters}>Clear</button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
            {!loading && !filteredItems.length && !error && <div className="empty-state"><h3>Nothing in this collection yet.</h3><p>Add your first piece below and give it a photo.</p></div>}
            <div className="clothing-grid">
              {filteredItems.map((item) => (
                <article className="clothing-item" key={item._id}>
                  {editingId === item._id ? (
                    <form className="auth-form item-edit-form" onSubmit={handleUpdateClothing}>
                      <h3>Edit {item.name}</h3>
                      <ClothingFields form={editForm} onChange={changeEditForm} categories={CATEGORIES} />
                      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                      <button type="button" className="button-outline" onClick={cancelEditing} disabled={saving}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <ClothingPhoto item={item} token={token} />
                      <div className="clothing-item__info">
                        <h3>{item.name}</h3>
                        <p>{[item.color, item.material,item.brand].filter(Boolean).join(" · ") || item.category}</p>{item.favorite&&<span className="eyebrow">♡ Favorite</span>}{item.sourceUrl&&<p><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Product source ↗</a></p>}
                        {(item.style || item.occasion || item.season) && <p className="clothing-item__meta">{[item.style,item.occasion,item.season].filter(Boolean).join(" · ")}</p>}
                        <div className="clothing-item__actions">
                          <button type="button" className="button-outline" onClick={() => startEditing(item)}>Edit</button>
                          <button type="button" className="button-outline" disabled={deletingId === item._id} onClick={() => handleDeleteClothing(item._id)}>{deletingId === item._id ? "Deleting…" : "Delete"}</button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      <details ref={addPanelRef} open={addPanelOpen} onToggle={e=>setAddPanelOpen(e.currentTarget.open)} className="wardrobe-add-panel" id="add-clothing">
        <summary><span>+ Add a clothing item</span><span className="wardrobe-add-panel__hint">Grow your collection →</span></summary>
        <form className="auth-form wardrobe-add-form" onSubmit={handleAddClothing}>
          <p>Camera roll, phone camera or product image URL: start by adding the item, then upload a photo inside its category. Website images can be linked directly in the form below.</p>
          <ClothingFields form={addForm} onChange={changeAddForm} categories={CATEGORIES} />
          <button type="submit" disabled={adding}>{adding ? "Adding…" : "+ Add clothing"}</button>
        </form>
      </details>
    </main>
  );
}
