# StyleCircle — Full-Mark Readiness Plan

This checklist uses the professor's grading categories and evidence from the repository. A checked criterion documents evidence, **not** a guaranteed professor score. The live release, third-party AI service and oral presentation must still be assessed in their actual environment.

## Functionality — target 30/30

- [x] React protected routes, signup/login and Express API implementation.
- [x] MongoDB-backed integration tests for wardrobe, outfit ownership, deletion integrity, FitCheck results and final voting.
- [x] Browser E2E has an authenticated wardrobe flow and refresh persistence.
- [ ] **Current PR #5:** broaden browser E2E to all feature routes, creating saved outfits through the UI, posting FitChecks through the UI, and testing desktop/mobile viewport overflow. Treat this as complete **only after the updated CI passes**.
- [ ] Manually verify the **latest deployed commit** on Vercel and Render (not the version tested before PR #3/#4): sign up, log in, upload a photo, add/edit/delete clothes, save/edit/delete outfits, create a FitCheck, vote from a second account, Planner/Packing/Wishlist/Moodboards/Insights, Style Studio, refresh, and error handling.
- [ ] Verify external AI service status/quota before presenting; show an *honestly labeled* previously generated example when no GPU is available. AI availability is not fully within the project's control.
- [ ] Check behavior with slow/temporarily unavailable backend and genuinely invalid inputs so users receive useful errors.

## Code quality & organization — target 20/20

- [x] Separate API routes, middleware, models, hooks and reusable components.
- [x] Extract FitCheck card, clothing picker, saved outfits, AI state logic and legacy image routes.
- [x] React production build and unit tests in CI.
- [ ] Review the still-large files **by responsibility**, not by arbitrary line count: `client/src/components/Avatar360.jsx`, `client/src/pages/FittingRoom.jsx`, `client/src/pages/Wardrobe.jsx`, `server/src/routes/tryOnRoutes.js`. Split only cohesive units that can be independently tested; preserve the existing appearance and feature behavior.
- [ ] Inspect imports and actual usage before removing dead or legacy code. Do not delete API routes or 3D components simply because they are large.
- [ ] Add a consistent formatting/lint check once existing code is brought into compliance; avoid putting untested tool changes directly in production.

## Design & UX — target 15/15

- [x] Custom editorial typography, palette and illustrations; responsive CSS.
- [x] Existing mobile checks at 390px; keyboard focus styles; label improvements.
- [x] Automated Chromium and axe-core checks on signup and home.
- [ ] **Current PR #5:** audit serious/critical accessibility findings and horizontal overflow on **every authenticated route** at desktop and 390px, and resolve any issues found.
- [ ] Manually test all forms and action buttons via **keyboard only**, tab order, visible focus, required/invalid states, alt text, empty states, loading states, meaningful error messages and contrast.
- [ ] Test an actual iPhone/Android browser and one tablet/desktop browser; automated Chromium does not replace real-device testing.

## Security & testing — target 15/15

- [x] bcrypt passwords, verified JWTs, ownership-scoped database queries, validation, Helmet, CORS, rate limiting and image-type limits.
- [x] Regression tests for expired tokens, foreign-owned records, invalid uploads, self-voting, concurrent votes and FitCheck photo preservation.
- [x] Disposable MongoDB integration testing; Playwright browser testing in GitHub Actions.
- [x] **Latest checked CI:** frontend and backend `npm audit` reported zero advisories on 2026-11-27. A future advisory may change this.
- [ ] Broaden browser end-to-end tests to additional user journeys; retain passing CI evidence on the **final commit**.
- [ ] Check security headers, CORS settings and production environment variables after deployment **without exposing secrets**.
- [ ] Verify malformed payloads, rate limits and server error responses. A test suite is not a penetration test.

## Documentation — target 10/10

- [x] Current authoritative root README with both public URLs, setup, technology, architecture and known AI limitations.
- [x] Schema, wireframes, milestones, security/testing notes and Postman evidence.
- [x] Superseded `README_FIRST.md` is labeled historical.
- [ ] Check all current instructions on a clean local clone, especially `npm ci`, environment-variable examples and links.
- [ ] Update `docs/testing.md` with the final E2E outcomes and links to the final successful GitHub Actions run.
- [ ] Avoid inventing milestone dates or retrospective tags: short progress updates and genuine commit references are provided instead, as allowed by the milestone brief.

## Presentation — target 10/10

- [x] Presentation deck and technical Q&A guide prepared.
- [ ] Rehearse a timed demonstration on the **current production deployment** and keep a known working account/demo dataset.
- [ ] Be ready to explain React components/state, Express routing, MongoDB schema, JWT authentication, bcrypt password checking, self-vote ownership checks, image storage and CI.
- [ ] Present AI limits accurately: external service, approximate front-view preview, quota/queue dependency; do not claim physically accurate body sizing.
- [ ] Verify the actual slide order, live transitions, backup screenshot, audience visibility and time limit. Grade depends on live delivery.

## Final acceptance gate

1. Latest GitHub Actions workflow green on the final commit.
2. Updated production frontend and backend confirmed working by user in Incognito.
3. End-to-end main flows and mobile navigation manually repeated **after** the newest deployment.
4. No uncaught Console errors or persistent broken references in the demonstrated workflows.
5. Links/README correct; no credentials in Git.
6. Presentation rehearsed with clear truthful answers and contingency for AI service outages.

**Important:** Passing this checklist maximizes defensible evidence; it does not make a professor's 100/100 automatic.
