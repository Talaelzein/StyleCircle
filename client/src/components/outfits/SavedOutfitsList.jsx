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
              <div className="saved-outfit-list">
                {outfits.map((outfit) => {
                  const pieces = (
                    outfit.clothingItemIds || []
                  ).filter(Boolean);

                  return (
                    <article
                      className="clothing-card saved-outfit-card"
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

                      <div className="saved-outfit-pieces">
                        {pieces.map((item) => (
                          <div key={item._id} className="saved-outfit-piece">
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
                        className="button-outline"
                        aria-label={`Edit outfit ${outfit.name}`}
                        onClick={() => onEdit(outfit)}
                      >
                        Edit
                      </button>

                      {" "}

                      <button
                        type="button"
                        className="button-outline"
                        aria-label={`Delete outfit ${outfit.name}`}
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
