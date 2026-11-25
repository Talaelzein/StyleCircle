# StyleCircle — All-in-One Upgrade (November 2026)

This is a COMPLETE React + Express + MongoDB project ZIP. It includes the hand-painted illustrated StyleCircle starter and later 360° fitting-room/photo-analysis modules, PLUS the new styling and wardrobe features listed below. It is NOT a one-file patch.

## Critical: protect your current project and account data

1. **Do not delete your working folder.** Rename it `StyleCircle_BACKUP` or copy it somewhere safe first.
2. Extract this ZIP into a **new** folder, rather than dragging individual files into the old one.
3. From the old project, copy **only** `server/.env` into the new `StyleCircle/server/.env`. Do not paste that secret into chat or commit it to GitHub. Keep the same `MONGO_URI` and `JWT_SECRET` so your existing MongoDB data and accounts remain accessible.
4. Don't copy `node_modules` or `dist` from the old folder; reinstall dependencies in the new project.
5. Open the new folder (`StyleCircle`) in VS Code.

This ZIP was assembled from the most recent StyleCircle source archives available in this chat, not from the exact live VS Code folder on your computer. If you made edits locally after those archives, keep the backup so they can be reconciled. The ZIP includes no live database contents and does not modify your database until you run it.

## Install on Windows

Option A: double-click `INSTALL_WINDOWS.bat` after you have copied `server/.env`.

Option B: in VS Code, open a terminal in `StyleCircle/server` and run:
```
npm.cmd install
npm.cmd run dev
```
Open a SECOND terminal in `StyleCircle/client`:
```
npm.cmd install
npm.cmd run dev
```

Open the local URL Vite prints (usually http://localhost:5173 or http://localhost:5174). MongoDB requires an internet connection to your Atlas cluster when used remotely. MediaPipe's body-analysis model also downloads on first use.

## What's included

### Preserved from the working StyleCircle concept
- Editorial cream/burgundy styling and colorful hand-drawn wardrobe-category art
- Opening closet animation, home page and category browsing
- Account login/signup and MongoDB wardrobe persistence
- Add, edit, delete and search clothes; private GridFS photo uploads
- Outfit Builder with 2–10 unique items
- FitCheck community polls, votes, change vote, close and delete
- Front/back photo fitting and PNG export; 360° interactive avatar; photo-guided body-proportion estimates
- Navigation draft preservation for clothing forms, outfits, FitCheck and the fitting room

### Newly upgraded
- Smart Mix & Match V2: university/dinner/etc., weather, style and season preferences; lock any piece, logical outfit shuffling, replace just one item, scores and explanations, save outfit and compare two looks via FitCheck
- More wardrobe metadata: brand, size, price, purchase date, favorite, product source URL, direct HTTPS image URL
- Import garment photos via file picker, mobile camera, or *direct HTTPS photo URL* (product web pages are stored as source links, **not automatically scraped**)
- Outfit Planner: calendar, schedule saved outfits, mark as worn
- Packing Lists: pick clothes from the wardrobe or a saved outfit; deduplicated packing checklist
- Wishlist: saved product URLs, optional photo links, estimated prices and notes
- Moodboards: inspiration cards with photo URLs, links and notes
- Wardrobe Insights: category/color breakdown, wear frequency, cost-per-wear when prices and wear logs exist
- All new entries are scoped to the logged-in account in MongoDB

## Technical and realism limitations

- MediaPipe + Three.js reconstruct **approximate body proportions**, not a photorealistic digital twin. The 3D avatar still uses simplified modeled clothing. Photo mode is image cutout/overlay, not an AI-generated physically accurate fit.
- Website imports currently accept direct HTTPS image links. Arbitrary product pages often block scraping/hotlinking; a pasted website URL alone does not automatically download images. Those can be kept as product links and paired with a manual photo upload.
- The app does not read current live weather automatically: its generator uses the weather choice supplied by the user.
- Wishlist prices and cost-per-wear use amounts as entered; there's no currency conversion.
- This ZIP is NOT deployment-ready or audited for production traffic. QA, accessibility, performance, permissions, privacy notices, image licensing and hosting remain necessary before a public release.
- Do not upload private body photographs to an untrusted third-party service. The current photo-guided analysis runs in the browser and downloads a MediaPipe model.

## Verification

- Full JavaScript/JSX source was parsed and local import paths checked in the authoring environment.
- A dependency-free native Node smoke suite passed for the new styling algorithm, including locked items, one-piece replacement and university-weather constraints.
- **The full Vite build and full database/API integration tests were not run in the authoring environment**, because npm dependencies could not be downloaded there. Run these locally:
```
cd client
npm.cmd install
npm.cmd run build
```
Backend algorithm smoke suite:
```
cd server
node --test src/utils/styleGenerator.node.test.js
```

If `npm.cmd run build` reports an error, keep the original project backup intact and share the **first** error line.

## Recommended acceptance checks

1. Login, view old clothes and uploaded images (same Mongo URI).
2. Add a piece with a photo, then edit/delete a temporary test piece.
3. For Mix & Match: lock a Top, choose University/Mild/Casual, generate several looks, replace a Bottom, save a look; verify the Top stays locked.
4. Send two saved Mix & Match outfits to FitCheck and confirm both dropdowns prefill. Vote from a different account.
5. Plan an outfit, log it as worn, inspect its cost per wear in Insights.
6. Create a packing list, wishlist card and moodboard card; refresh and verify they persist.
7. Upload front/back photos in Virtual Fitting Room, test 360 rotation and PNG export. Verify body-photo privacy expectations.

This is a feature-rich prototype baseline, not a claim that every Whering feature or a photorealistic digital twin is already implemented.
