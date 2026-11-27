import ClothingPreview from "../ClothingPreview.jsx";

// Presentation-only wardrobe selector: the parent owns selected clothing.
export default function ClothingPicker({ clothes, selectedIds, token, onToggle }) {
  return (
    <div className="outfit-clothing-grid">
      {clothes.map((item) => {
        const selected = selectedIds.includes(item._id);
        const disabled = !selected && selectedIds.length >= 10;
        return (
          <label
            key={item._id}
            className={`outfit-clothing-option${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
          >
            <div className="outfit-clothing-option__row">
              <ClothingPreview item={item} token={token} size={90} />
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(item._id)}
                aria-label={`Select ${item.name}`}
              />
            </div>
            <strong>{item.name}</strong>
            <p>{item.category}{item.color ? ` — ${item.color}` : ""}</p>
          </label>
        );
      })}
    </div>
  );
}
