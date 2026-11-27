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

To run MongoDB-backed tests locally, start a **disposable** MongoDB instance and set `TEST_MONGO_URI=mongodb://127.0.0.1:27017/stylecircle_ci` before running `npm test`. Those tests use a dedicated `stylecircle_capstone_tests` database and clear it; never point test credentials at a production server. In GitHub Actions, the backend job provisions its own temporary MongoDB container. Without `TEST_MONGO_URI`, the database integration suite is skipped while unit tests still run.

These checks cover React authentication and FitCheck UI actions, backend health/auth/validation, outfit matching, and (in CI) a **real disposable MongoDB-backed request test** in `server/tests/databaseIntegration.test.js`. That suite verifies cross-account access rejection, expired tokens, image-byte validation, saving outfit references, concurrent/final voting, results privacy and post-closure visibility, and persistence of photos shared in FitCheck snapshots. It does **not** replace a full browser test of the production deployment or a professional security assessment.

## Post-change checks required

After deploying these changes to the live app, repeat the Incognito login, wardrobe refresh, outfit creation and voting smoke checks. Specifically verify: (1) deleting a garment used by an outfit shows an understandable message and leaves the item intact; (2) after removing it from all outfits, delete works; (3) FitCheck totals are hidden before voting, a first vote works, and the choice cannot be changed; (4) shared FitCheck photos remain visible if the underlying clothing is later deleted. The CI database tests exercise these flows on a temporary database but cannot certify external hosting, GPU quota, or appearance on every device.

## Automated browser and accessibility checks

The CI `browser_e2e` job runs Chromium against a **local React frontend and Express API connected to an isolated MongoDB service**. `client/tests/e2e.mjs` signs up a test account, stores four clothing pieces, creates two saved outfits through the UI, reloads and verifies persistence, posts a FitCheck, signs up a second account to verify that totals are hidden before voting and one final vote is enforced, visits all principal routes, checks desktop/mobile responsiveness (390 px), and fails on uncaught JavaScript errors. Axe-core scans each tested route **after session restoration** and rejects any accessibility rule violation, including moderate ones. Screenshots and logs are uploaded to GitHub Actions for seven days. This runs against a disposable local database, not production Vercel/Render.

## Dependency security audit

The `dependency_audit` CI job inspects npm advisories for both `client/` and `server/`. It now fails for any high or critical advisory. The earlier Vitest 3/Tinypool warnings were addressed by upgrading Vitest and the required Vite peer dependency, with both lockfiles regenerated in a GitHub runner. Audit results must always be read from the latest passing workflow; dependency risk can change over time.

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
