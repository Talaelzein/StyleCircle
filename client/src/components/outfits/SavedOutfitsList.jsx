import ClothingPreview from "../ClothingPreview.jsx";

// Presentation-only card list for the saved-outfit feature.
export default function SavedOutfitsList({ outfits, token, deletingId, onEdit, onDelete }) {
  return (
    <section aria-labelledby="saved-outfits-heading">
            <h2 id="saved-outfits-heading">My Saved Outfits</h2>

            {outfits.length === 0 ? (
              <p>
                You haven't saved any outfits yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "18px"
                }}
              >
                {outfits.map((outfit) => {
                  const pieces = (
                    outfit.clothingItemIds || []
                  ).filter(Boolean);

                  return (
                    <article
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

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(130px, 1fr))",
                          gap: "12px",
                          marginBottom: "16px"
                        }}
                      >
                        {pieces.map((item) => (
                          <div
                            key={item._id}
                            style={{
                              padding: "10px",
                              border: "1px solid #ddd",
                              borderRadius: "12px"
                            }}
                          >
                            <ClothingPreview
                              item={item}
                              token={token}
                              size={110}
                            />

                            <p>
                              <strong>{item.name}</strong>
                            </p>

                            <p>
                              {item.category}
                              {item.color
                                ? ` — ${item.color}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>

                      {pieces.length === 0 && (
                        <p>
                          The clothing items for this
                          outfit are no longer available.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onEdit(outfit)
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
                          onDelete(outfit._id)
                        }
                      >
                        {deletingId === outfit._id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

    </section>
  );
}
