# StyleCircle — Verification and Testing

The running application is a React/Vite frontend connected to an Express/Mongoose backend. This document distinguishes **automated evidence**, **manual smoke tests**, and **known external limitations**.

## Automated checks

GitHub Actions: `.github/workflows/ci.yml`. On pull requests to `master`, it installs exact lockfile dependencies, executes all React and Express tests, and builds the production frontend.

To run independently from the repository root:

```bash
cd client
npm ci
npm test
npm run build
```

In another terminal:

```bash
cd server
npm ci
npm test
```

These tests cover React login and anonymous-route behavior; FitCheck UI actions; category navigation; backend health and anonymous-access rejection; validation/error responses; and outfit-matching logic. **They do not replace a full browser or connected MongoDB integration test.**

## Previously completed manual production smoke tests

The project owner verified on the Vercel-hosted app:
1. My Closet and AI Style Studio load, including a page refresh.
2. Login and logout work.
3. Saved wardrobe items and images persist after refresh.
4. A saved outfit displays and persists after refresh.
5. FitCheck posts/images and a recorded vote persist after refresh.
6. Planner, Packing, Wishlist, Moodboards, Insights and Mix & Match open correctly.
7. AI Style Studio shows photograph upload and clothing selection; a successful jacket-and-skirt AI result is documented by a screenshot.

These are observed checks, not a guarantee that every data-manipulation path or third-party service will always work.

## Final acceptance test before grading

- Open the public Vercel URL in a **new private/incognito browser** and verify initial page load and direct-route refresh.
- Create a fresh test account and log in again.
- Create, edit and delete a disposable clothing item and confirm the state after refresh.
- Create and edit a disposable outfit using two owned clothing items.
- Check that an anonymous request to `/api/clothing-items` is rejected with 401 and `/api/health` returns JSON with `status: "ok"`.
- Check the UI on mobile width (e.g., Chrome DevTools, 390 × 844): navigation, wardrobe grids, forms, FitCheck and Studio.
- Use the browser developer Console to investigate **uncaught exceptions** on page load or navigation.
- Check the Render API remains reachable and database-backed data loads.
- If a live AI demonstration is planned, check the Hugging Face quota in advance; free GPU availability is not guaranteed.

## Known constraints

- The AI try-on system integrates third-party Hugging Face spaces. These can exhaust shared ZeroGPU allowance, go offline, or queue requests. A successful previously generated image should be available for an honest backup demonstration.
- AI output is a front-view visual approximation and is not size-accurate or photorealistic 360-degree reconstruction.
- Browser IndexedDB stores imported/generated try-on previews locally; they do not automatically synchronize between devices.
- A successful automated test run does not guarantee high-availability hosting or third-party inference.
