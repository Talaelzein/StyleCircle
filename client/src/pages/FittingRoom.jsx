
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ClothingPreview from "../components/ClothingPreview.jsx";
import { API_URL, getResponseData } from "../services/api.js";
import { generateTryOn } from "../services/tryOn.js";
import "../styles/fitting-room.css";

const MAX_PHOTO = 15 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
function accountId(token) {
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

function openPhotoDB() {
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

async function storage(action, key, blob) {
  const db = await openPhotoDB();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        "photos",
        action === "get" ? "readonly" : "readwrite"
      );

      const store = transaction.objectStore("photos");

      const request =
        action === "put" ? store.put(blob, key) :
        action === "delete" ? store.delete(key) :
        store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function initialSelection(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    return Array.isArray(data.picked) ? data.picked[0] || "" : "";
  } catch {
    return "";
  }
}

export default function FittingRoom({ token }) {
  const account = accountId(token);
  const selectionKey = `stylecircle:studio:positions:${account}`;
  const resultKey = `${account}:ai-result`;
  const resultMetaKey = `stylecircle:studio:result-item:${account}`;

  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [clothes, setClothes] = useState([]);
  const [selectedId, setSelectedId] = useState(() =>
    initialSelection(selectionKey)
  );

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const photoRef = useRef(null);
  const resultRef = useRef(null);
  const urlsRef = useRef(new Set());

  function makeURL(blob) {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const [savedPhoto, savedResult] = await Promise.all([
          storage("get", `${account}:front`),
          storage("get", resultKey)
        ]);

        if (cancelled) return;

        if (savedPhoto instanceof Blob) {
          const restored = {
            blob: savedPhoto,
            url: makeURL(savedPhoto)
          };

          photoRef.current = restored;
          setPhoto(restored);
        }

        const resultItem = localStorage.getItem(resultMetaKey);

        if (
          savedResult instanceof Blob &&
          resultItem === initialSelection(selectionKey)
        ) {
          const restored = {
            blob: savedResult,
            url: makeURL(savedResult)
          };

          resultRef.current = restored;
          setResult(restored);
        }
      } catch {
        if (!cancelled) {
          setError("Could not restore photos from browser storage.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();

    return () => {
      cancelled = true;
    };
  }, [account, resultKey, resultMetaKey, selectionKey]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadClothes() {
      try {
        const response = await fetch(
          `${API_URL}/api/clothing-items`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        const data = await getResponseData(response);

        if (!controller.signal.aborted) {
          setClothes(data.items || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Could not load wardrobe.");
        }
      }
    }

    loadClothes();
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    try {
      localStorage.setItem(
        selectionKey,
        JSON.stringify({
          picked: selectedId ? [selectedId] : []
        })
      );
    } catch {
      // Selection still works without browser storage.
    }
  }, [selectedId, selectionKey]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const availableClothes = clothes;

  const selectedItem = availableClothes.find(
    item => String(item._id) === String(selectedId)
  );

  async function clearResult() {
    resultRef.current = null;
    setResult(null);
    localStorage.removeItem(resultMetaKey);

    try {
      await storage("delete", resultKey);
    } catch {
      // The visible result has already been cleared.
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!TYPES.includes(file.type) || file.size > MAX_PHOTO) {
      setError("Choose a JPG, PNG or WebP image under 15 MB.");
      return;
    }

    setError("");
    setMessage("");

    const next = {
      blob: file,
      url: makeURL(file)
    };

    photoRef.current = next;
    setPhoto(next);
    await clearResult();

    try {
      await storage("put", `${account}:front`, file);
      setMessage("Your full-body photo has been saved locally.");
    } catch {
      setError("The photo is visible, but could not be saved.");
    }
  }

  async function chooseItem(item) {
    if (generating) return;

    const id = String(item._id);

    if (selectedId === id) return;

    setSelectedId(id);
    setError("");
    setMessage("");
    await clearResult();
  }

  async function generate() {
    if (!photo?.blob || !selectedItem || generating) return;

    if (!consent) {
      setError(
        "Please confirm that you agree to send the images to the external AI service."
      );
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("Generating your realistic AI try-on...");

    try {
      let garment;

      if (selectedItem.imagePublicId) {
        const response = await fetch(
          `${API_URL}/api/images/clothing/${selectedItem._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error("Could not load the clothing image.");
        }

        garment = await response.blob();
      } else if (selectedItem.imageUrl?.startsWith("https://")) {
        const response = await fetch(selectedItem.imageUrl);

        if (!response.ok) {
          throw new Error("Could not load the clothing image.");
        }

        garment = await response.blob();
      } else {
        throw new Error(
          "Upload a clothing photo in My Wardrobe first."
        );
      }

      const imageUrl = await generateTryOn({
        personImage: photo.blob,
        garmentImage: garment,
        category: selectedItem.category,
        description: [
          selectedItem.color,
          selectedItem.name,
          selectedItem.category
        ].filter(Boolean).join(" ")
      });

      let generated = { url: imageUrl, blob: null };

      try {
        const response = await fetch(imageUrl);

        if (response.ok) {
          const blob = await response.blob();

          if (blob.type.startsWith("image/")) {
            generated = {
              blob,
              url: makeURL(blob)
            };

            await storage("put", resultKey, blob);
            localStorage.setItem(
              resultMetaKey,
              String(selectedItem._id)
            );
          }
        }
      } catch {
        // Display the AI result even if local caching fails.
      }

      resultRef.current = generated;
      setResult(generated);
      setMessage("Your AI try-on is ready!");
    } catch (err) {
      const details = String(err?.message || "");
      const unavailable =
        /quota|zerogpu|busy|429|limit exceeded/i.test(details);

      setError(
        unavailable
          ? "The free AI service is temporarily unavailable. You can still import a previously generated try-on result."
          : details || "AI try-on failed. Please try again."
      );
      setMessage("");
    } finally {
      setGenerating(false);
    }
  }

  async function importResult(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!TYPES.includes(file.type) || file.size > MAX_PHOTO) {
      setError("Choose a generated JPG, PNG or WebP image under 15 MB.");
      return;
    }

    const imported = {
      blob: file,
      url: makeURL(file)
    };

    resultRef.current = imported;
    setResult(imported);
    setError("");

    try {
      await storage("put", resultKey, file);
      localStorage.setItem(resultMetaKey, selectedId);
      setMessage("Your AI result has been saved locally.");
    } catch {
      setMessage("AI result loaded, but local saving is unavailable.");
    }
  }

  async function downloadResult() {
    if (!result) return;

    if (!result.blob) {
      window.open(result.url, "_blank", "noopener,noreferrer");
      return;
    }

    const link = document.createElement("a");
    link.href = result.url;
    link.download = "stylecircle-ai-tryon.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <main className="auto-studio">
      <header className="auto-studio-heading">
        <div>
          <p className="eyebrow">STYLECIRCLE · AI EXPERIENCE</p>
          <h1>AI Style Studio</h1>
          <p>
            Try on your own wardrobe with realistic AI-generated
            photographs. No dragging, resizing or manual fitting.
          </p>
        </div>

        <Link className="auto-studio-link" to="/wardrobe">
          My Wardrobe
        </Link>
      </header>

      <div className="auto-studio-layout">
        <aside className="auto-studio-panel">
          <h2>1. Your photograph</h2>

          <p className="auto-studio-hint">
            Use a clear, front-facing photograph with your entire
            body visible from head to feet.
          </p>

          <div className="auto-studio-upload">
            <label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={generating}
                onChange={uploadPhoto}
              />

              {photo ? (
                <img src={photo.url} alt="Your front-view photo" />
              ) : (
                <span className="auto-studio-add">+</span>
              )}

              <span>
                {photo ? "Change photograph" : "Upload photograph"}
              </span>
            </label>
          </div>

          <p className="auto-studio-hint">
            Your original photo is stored in this browser.
          </p>

          <h2 style={{ marginTop: 25 }}>2. Select a garment</h2>

          <p className="auto-studio-hint">
            Choose any item from your wardrobe. Tops, bottoms and dresses use category-specific AI models.
          </p>

          <div
            className="auto-studio-clothes"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(110px, 1fr))",
              maxHeight: 350,
              overflowY: "auto"
            }}
          >
            {availableClothes.map(item => {
              const active = selectedId === String(item._id);

              return (
                <button
                  type="button"
                  key={item._id}
                  disabled={generating}
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  onClick={() => chooseItem(item)}
                >
                  <ClothingPreview
                    item={item}
                    token={token}
                    size={90}
                  />

                  <strong>{item.name}</strong>
                  <small>{item.category}</small>

                  {active && (
                    <span className="auto-studio-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {!availableClothes.length && (
            <p className="auto-studio-hint">
              Add clothing to your wardrobe to begin.
            </p>
          )}

          <h2 style={{ marginTop: 25 }}>3. Generate</h2>

          <label
            className="auto-studio-hint"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginBottom: 15
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={event => setConsent(event.target.checked)}
            />
            I understand that my person and garment photographs
            will be sent to the third-party Hugging Face AI service.
          </label>

          <button
            className="auto-studio-primary"
            type="button"
            onClick={generate}
            disabled={
              !photo ||
              !selectedItem ||
              !consent ||
              generating ||
              loading
            }
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 30,
              border: 0,
              fontWeight: 700
            }}
          >
            {generating
              ? "Generating AI Try-On..."
              : "✦ Generate AI Try-On"}
          </button>

          <p className="auto-studio-hint">
            AI try-on uses external research models. Free GPU availability may vary.
            Tops, outerwear, bottoms and dresses are the currently configured
            categories; shoes and accessories remain visible but need a
            different AI model.
          </p>
        </aside>

        <section className="auto-studio-panel auto-studio-viewer">
          <h2>Your fitting room</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16
            }}
          >
            <div>
              <h3 style={{ textAlign: "center" }}>Before</h3>

              <div
                className="auto-studio-stage"
                style={{ minHeight: 440 }}
              >
                {photo ? (
                  <img
                    className="auto-studio-body"
                    src={photo.url}
                    alt="Original full-body photograph"
                  />
                ) : (
                  <div className="auto-studio-empty">
                    <h3>Your photo</h3>
                    <p>Upload a full-body photograph.</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 style={{ textAlign: "center" }}>AI Try-On</h3>

              <div
                className="auto-studio-stage"
                style={{ minHeight: 440 }}
              >
                {result ? (
                  <img
                    className="auto-studio-body"
                    src={result.url}
                    alt="Realistic AI-generated clothing try-on"
                  />
                ) : (
                  <div className="auto-studio-empty">
                    <span>✦</span>
                    <h3>
                      {generating
                        ? "AI is creating your look"
                        : "Your new look"}
                    </h3>
                    <p>
                      {generating
                        ? "Generating with the selected AI model..."
                        : "Choose a garment and generate a preview."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="auto-studio-actions">
            <button
              className="auto-studio-primary"
              type="button"
              disabled={!result}
              onClick={downloadResult}
            >
              Download result
            </button>

            <label
              className="auto-studio-secondary"
              style={{ cursor: "pointer" }}
            >
              Import generated result
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!photo || !selectedItem || generating}
                onChange={importResult}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <p className="auto-studio-disclaimer">
            AI-generated visualization, not an exact prediction
            of garment fit or size. External research models are
            used; results and availability
            may vary.
          </p>
        </section>
      </div>

      {error && (
        <p role="alert" className="auto-studio-feedback error">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="auto-studio-feedback">
          {message}
        </p>
      )}
    </main>
  );
}
