// Shared add / edit form. Product URLs are kept separate from clothing photos.
export default function ClothingFields({form,onChange,categories}){
  const textFields=[
    ['name','Clothing name','e.g. Blue linen shirt',80],
    ['color','Color','e.g. Blue, white',40],
    ['material','Material','Cotton, linen, denim...',50],
    ['style','Style','Casual, elegant...',50],
    ['occasion','Occasion','University, dinner...',50],
    ['season','Season','Summer, spring...',50],
    ['brand','Brand (optional)','e.g. Zara',80],
    ['size','Size (optional)','e.g. M / 38',40]
  ];
  return <>
    {textFields.slice(0,1).map(([key,label,placeholder,maxLength])=><label key={key} className="closet-field">{label}<input name={key} value={form[key]??''} onChange={onChange} placeholder={placeholder} required maxLength={maxLength}/></label>)}
    <label className="closet-field">Category<select name="category" value={form.category} onChange={onChange} required>{categories.map(category=><option key={category} value={category}>{category.charAt(0).toUpperCase()+category.slice(1)}</option>)}</select></label>
    {textFields.slice(1).map(([key,label,placeholder,maxLength])=><label key={key} className="closet-field">{label}<input name={key} value={form[key]??''} onChange={onChange} placeholder={placeholder} maxLength={maxLength}/></label>)}
    <label className="closet-field">Price you paid (optional)<input name="price" type="number" min="0" max="100000000" step="0.01" value={form.price??0} onChange={onChange}/></label>
    <label className="closet-field">Purchase date (optional)<input name="purchaseDate" type="date" value={form.purchaseDate??''} onChange={onChange}/></label>
    <label className="closet-field">Original product page (HTTPS)<input name="sourceUrl" type="url" value={form.sourceUrl??''} onChange={onChange} placeholder="https://shop.example.com/item" maxLength={1200}/></label>
    <label className="closet-field">Direct image URL (HTTPS, optional)<input name="imageUrl" type="url" value={form.imageUrl??''} onChange={onChange} placeholder="https://example.com/image.jpg" maxLength={1200}/></label>
    <p className="collection-help">To import from a website, paste the <strong>direct image URL</strong> here, then save. For photos from your camera roll or phone camera, create the item and use the photo upload underneath it. A webpage URL isn't automatically an image.</p>
    <label className="closet-field" style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" name="favorite" checked={Boolean(form.favorite)} onChange={onChange}/> Add to favorites ♡</label>
  </>;
}
