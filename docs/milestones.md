# StyleCircle — Capstone Milestone Evidence

This file is the requested short public progress update for each milestone. It links to repository evidence; it does not claim that milestones were submitted on particular earlier dates. The original project scaffold and core backend are both visible in the initial repository commit.

## Milestone 1 — Scaffold, wireframes and schema
**Completed baseline** — [Initial repository commit](https://github.com/Talaelzein/StyleCircle/commit/798bc2a9a6538a6bc0676dc5b81c5a3f40979d3d).
- React/Vite app and client-side routing: `client/src/App.jsx`, `client/src/main.jsx`.
- Express app and test route: `server/src/app.js` → `GET /api/health`.
- MongoDB/Mongoose connection from `MONGO_URI`: `server/src/config/db.js`.
- Secrets excluded by `.gitignore`; examples in `client/.env.example`, `server/.env.example`.
- [Milestone wireframes](wireframes.md) and [database schema](database-schema.md) included.

## Milestone 2 — Core backend
**Completed** — [Milestone 2 commit](https://github.com/Talaelzein/StyleCircle/commit/798bc2a9a6538a6bc0676dc5b81c5a3f40979d3d).
- `/api/auth/signup`, `/api/auth/login` and `/api/auth/me`, bcrypt password hashing, and JWT.
- Auth middleware: `server/src/middleware/requireAuth.js`.
- CRUD endpoints: `server/src/routes/clothingRoutes.js`; outfit and other routes added later.
- Zod input validation and appropriate HTTP errors.
- [Postman collection](../postman/StyleCircle_Milestone2.postman_collection.json) and backend smoke tests.

## Milestone 3 — Frontend integrated
**Completed** — [Core features commit](https://github.com/Talaelzein/StyleCircle/commit/222814f4340604edbd71d1cfa482957faf296dc8), [expanded features/tests commit](https://github.com/Talaelzein/StyleCircle/commit/ad3c8489f9b4556ecec8e879c903f21f82550e8c).
- React forms, protected navigation, API fetches, and persistent backend data.
- My Closet, Outfits, Mix & Match, FitCheck; Planner, Packing, Wishlist, Moodboards, Insights.
- Front-view AI Style Studio with pretrained virtual try-on models: [AI release commit](https://github.com/Talaelzein/StyleCircle/commit/43b23a8df241fb0845542960cfc6f62726b98b2d).
- CSS media queries support responsive layouts; mobile usability still requires device-level checking.

## Milestone 4 — Public deployment
**Deployed** — [Production merge commit](https://github.com/Talaelzein/StyleCircle/commit/43b23a8df241fb0845542960cfc6f62726b98b2d).
- Vercel serves the React frontend; Render serves the Express backend.
- MongoDB Atlas is used for production persistence.
- Server secrets are configured on the hosting provider, not in Git.
- The project owner manually verified login/logout, wardrobe and outfit persistence, FitCheck votes, navigation, and supporting pages on the live site.
- Public frontend: https://style-circle.vercel.app/; public backend API: https://stylecircle.onrender.com; API health route: https://stylecircle.onrender.com/api/health. URLs were supplied by the project owner for the final README; final live availability should be checked from an ordinary browser before submission.

## Grader access
See the root `README.md` for installation, testing, and the exact public links. The application requires signup/login for private functionality. The Hugging Face AI generation service has daily GPU quota limits; a previously generated example is available for a demo even if the external service has no remaining quota.

## Chronology limitation and tagging

The initial repository commit contains both baseline scaffold and early backend work, so Milestones 1 and 2 point to the same genuine commit. Their recorded completion evidence is deliberately **not backdated**. This repository publishes separate short milestone updates here as one of the professor's allowed evidence formats. It does **not** claim that distinct historical milestone tags existed at submission time. Future projects should tag or post each milestone contemporaneously.
