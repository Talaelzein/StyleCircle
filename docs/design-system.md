# StyleCircle visual system — first working pass

## Creative direction
A spacious, cream-toned editorial interface with elegant serif type and expressive, visibly hand-painted fashion drawings. The fashion drawings are not generic interface icons: they are category illustrations. Real clothing photos appear **inside** My Closet after a user chooses a category.

## Replace drawings without rewriting code
- Art for category tiles: `client/public/illustrations/categories/`
- Art for intro and homepage: `client/public/illustrations/scenes/`
- Categories/routes/captions: `client/src/data/categories.js`
- Overall colors, fonts, and radius: `client/src/styles/tokens.css`
- App layout and animation: `client/src/styles/site.css`
- Styling for already-functional existing pages: `client/src/styles/legacy.css`
- Entry animation React page: `client/src/pages/Intro.jsx`
- Home: `client/src/pages/Home.jsx`
- Functional closet: `client/src/pages/Wardrobe.jsx`

For a simple illustration swap, keep the existing `.webp` filename and dimensions (or adapt `object-fit` in CSS). Reload the browser; no backend/database changes. To add a new backend category, update server validation/schema and UI together.

## Honest implementation notes
- The initial wardrobe animation is a CSS crossfade between two painted scenes, **not** a fully hand-animated frame-by-frame transformation. Future refinement can animate individual wardrobe items. It auto-plays at the app's root for the first visit in a browser session and can be skipped.
- The current backend has one `accessory` category; Jewelry and Glasses both open the shared Accessories collection. Adding distinct subcategories requires backend data support and UI filters.
- This pass adds illustrated intro, homepage, gallery navigation and responsive global design. It leaves existing CRUD, authentication, Outfit Builder, Smart Mix & Match, FitCheck and Fitting Room logic in place. Those feature screens get shared typography/layout styling, but **do not yet exactly match the detailed feature mockups**.
- The images in `public/illustrations` were newly generated for the StyleCircle design exploration; review and refine before a public commercial launch.
- The existing `.env` files were deliberately excluded from the ZIP.
