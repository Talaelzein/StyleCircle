export const closetCategories = [
  { label: "Tops", key: "top", art: "tops.webp", hint: "Shirts, blouses & knits" },
  { label: "Bottoms", key: "bottom", art: "bottoms.webp", hint: "Jeans, trousers & skirts" },
  { label: "Dresses", key: "dress", art: "dresses.webp", hint: "A little something special" },
  { label: "Jackets / Outerwear", key: "outerwear", art: "outerwear.webp", hint: "Layers worth keeping" },
  { label: "Shoes", key: "shoes", art: "shoes.webp", hint: "From heels to sneakers" },
  { label: "Bags", key: "bag", art: "bags.webp", hint: "Your collection of bags" },
  { label: "Accessories", key: "accessory", art: "accessories.webp", hint: "Hats, scarves & belts" },
  { label: "Jewelry", key: "jewelry", art: "jewelry.webp", hint: "Rings, necklaces & earrings" },
  { label: "Glasses", key: "glasses", art: "glasses.webp", hint: "Sunglasses & optical frames" }
];

export const illustrationUrl = (name) =>
  `/illustrations/categories/${name}`;
