// SHARED CLOTHING FORM FIELDS
export default function ClothingFields({ form, onChange, categories }) {
  const fields = [
    ["name", "Clothing Name", "e.g. White Cotton Shirt"],
    ["color", "Color", "e.g. White"],
    ["material", "Material", "e.g. Cotton, denim, silk"],
    ["style", "Style", "e.g. Casual, elegant"],
    ["occasion", "Occasion", "e.g. University, dinner"],
    ["season", "Season", "e.g. Summer, winter"]
  ];

  return (
    <>
      {fields.slice(0, 1).map(([key, label, placeholder]) => (
        <label className="closet-field" key={key}>
          {label}
          <input
            name={key}
            value={form[key]}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={80}
            required
          />
        </label>
      ))}

      <label className="closet-field">
        Category
        <select
          name="category"
          value={form.category}
          onChange={onChange}
          required
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() +
                category.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {fields.slice(1).map(([key, label, placeholder]) => (
        <label className="closet-field" key={key}>
          {label}
          <input
            name={key}
            value={form[key]}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={40}
          />
        </label>
      ))}
    </>
  );
}

