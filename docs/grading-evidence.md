# StyleCircle — Evidence for Each Capstone Grading Criterion

The professor evaluates six categories totaling 100 points. This file shows **evidence**, not a promise of full marks. The actual grade belongs to the evaluator.

## Functionality (30 points)

- Functional React/Vite UI and Express REST API, backed by MongoDB and GridFS.
- Working user authentication, wardrobe create/read/update/delete, private image handling, saved outfits, community FitCheck, rule-based Mix & Match, Planner, Packing, Wishlist, Moodboards and Insights.
- AI Style Studio connects to external pretrained models; it has an explicit quota/availability limitation, and a real previously generated result can be used for a transparent demonstration.
- Data integrity: a clothing item used in a saved outfit is not deletable until its references are removed; pending Planner outfits are protected; deleting clothing cleans its references from packing/wear entries without erasing the records themselves.
- Evidence: backend database integration tests (client ownership, saved outfit references, photo preservation, invalid uploads and voting), local Chromium end-to-end tests, and production smoke checks recorded in [testing.md](testing.md).
- **Required final check:** manually rerun the live public flows after the latest deployment, including AI failure handling; no automated test can guarantee third-party GPU uptime.

## Code quality & organization (20 points)

- Frontend and backend are organized into independent directories, with React components, hooks and services plus Express routes, middleware, database models and utility modules.
- Dedicated modules for SavedOutfitsList, ClothingPicker, FitCheckCard, AI Studio selection/storage helpers, GridFS image retention and legacy AI routes.
- Backend validation and ownership checks are separate from UI forms, with tests checking the business rules.
- **Remaining improvement opportunity:** some feature pages are still long or use compressed JSX; code quality is assessed by clarity and behavior, not line count alone.

## Design & user experience (15 points)

- Original illustrated fashion identity, typography and palette documented in [design-system.md](design-system.md), with responsive grids and selected focus states.
- Chromium checks for visual loading, page errors, narrow viewport overflow and axe-core accessibility; screenshot artifacts are retained for seven days by GitHub Actions.
- **Required final check:** real-device usage and broader assistive-technology testing go beyond automated scans.

## Security & testing (15 points)

- bcrypt password hashing; signed JWT verification; per-account MongoDB filters; user-owned resource checks; Zod input validation; Helmet, CORS, rate limiting; validated image content and file-size restrictions.
- FitCheck self-voting is rejected with HTTP 403; unique composite vote index protects against duplicate rows and conflict responses explain blocked changes.
- GitHub Actions installs reproducible lockfile dependencies, runs React tests and build, Express request tests against disposable MongoDB, Chromium end-to-end tests and axe-core checks.
- npm audit fails the build on any new high/critical advisory; see the actual newest workflow log for the current count.
- **Qualification:** these checks do not equal penetration testing or a blanket guarantee of production security.

## Documentation (10 points)

- Root [README](../README.md): verified public frontend/backend URLs, technology stack, API summary, architecture, local setup, screenshots/tests references and honest external AI limitations.
- [Database schema](database-schema.md), [wireframes](wireframes.md), [milestone evidence](milestones.md), [testing notes](testing.md), [remediation matrix](remediation.md) and [Postman collection](../postman/StyleCircle_Milestone2.postman_collection.json).
- Milestone updates link genuine historical commits. They do **not** manufacture distinct commit timestamps or claim that all earlier milestone updates were posted by a past deadline.

## Presentation and Q&A (10 points)

- [Presentation guide](presentation-guide.md) includes a timed demo, cross-account FitCheck demonstration, relevant architecture/security explanations and a quota-safe fallback.
- A separate PowerPoint presentation has been prepared for the owner. The existence of a file or script is **not** evidence that the oral exam was delivered well.
- **Required final check:** rehearse and time the live demo, test the public deployment, make sure a second voting account works, and practice independent Q&A.

## Practical evidence to show the grader

1. The public Vercel website and signed-in live user journey.
2. The Render API health endpoint and persistent MongoDB data.
3. The latest green [GitHub Actions](https://github.com/Talaelzein/StyleCircle/actions) run, including browser/axe, security/dependency and integration tests.
4. A simple architecture diagram and selected source files that the student can explain independently.
5. A successful live or transparently prerecorded AI try-on output, with external quota limitations disclosed.

**Grade target:** Build a defensible 100-point submission, not an untestable claim of a guaranteed 100/100.
