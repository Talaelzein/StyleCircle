# StyleCircle

**Your wardrobe, your style, your circle.**

StyleCircle is a full-stack web application for managing a digital wardrobe, creating outfits, getting personalized styling suggestions, voting on looks, and exploring realistic AI virtual try-on.

## Live application

> **Public links for the capstone grader:** Open the deployed frontend directly. The API health endpoint is public; other API features require appropriate authentication.

- **Frontend (Vercel):** https://style-circle.vercel.app/
- **Backend API (Render):** https://stylecircle.onrender.com
- **API health check:** https://stylecircle.onrender.com/api/health

The frontend requires signup or login to access private features. The health endpoint is public.

## Technologies

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React 19, React Router, JavaScript/JSX | Component-driven UI and protected routes |
| Tooling | Vite, npm | Local development and frontend production build |
| Styling | CSS, Flexbox, Grid, media queries | Editorial design and responsive layouts |
| Backend | Node.js, Express | REST endpoints, validation, business rules |
| Database | MongoDB, Mongoose | Persistent users, clothes, outfits, FitChecks and style entries |
| Images | MongoDB GridFS | Private clothing-photo storage |
| Auth | bcrypt, JWT | Password hashing and authenticated requests |
| Validation/security | Zod, Helmet, CORS, rate limits | Server-side validation and request protections |
| AI | Hugging Face Gradio-client Spaces | Image-based virtual try-on via server-held token |
| Deployment | Vercel + Render | Public frontend + API hosting |

## Main features

- **My Closet:** add, browse, search, edit and delete clothing, photos and wardrobe metadata. Items used in a saved outfit cannot be deleted until removed from that outfit; the app explains this restriction. Photos referenced by shared FitChecks are retained.
- **Outfits:** build and save outfits from 2–10 distinct wardrobe items.
- **Mix & Match:** rule-based styling suggestions considering occasion, style, season and user-selected weather; lock or replace clothing pieces, and save a look.
- **FitCheck:** social comparison of two outfits, with one final vote per account (no changes), poll closure and owner self-vote prevention. Vote totals stay hidden from nonvoters while the poll is open; voters and the poll owner can see them, and closed polls show final totals.
- **Planner:** calendar planning and recording what was worn.
- **Packing:** pack lists linked to wardrobe items.
- **Wishlist:** save products, references, price notes and images.
- **Moodboards:** save visual inspiration.
- **Insights:** wardrobe composition, wear frequency, favorite items and cost-per-wear where data is available.
- **AI Style Studio:** upload a front-view person photo and select one or more clothes; use pretrained IDM-VTON / Leffa / CatVTON services for realistic image-based previews. View before/after, download, or import a previously generated result.

**Note:** Mix & Match is rule-based styling logic; the AI Style Studio is a separate external model integration. AI image output is an approximate *front-view visualization*, not a size-accurate measurement or photorealistic 360-degree reconstruction.

## Architecture

```text
Browser (React / Vercel)
      |
      | HTTPS fetch + JSON + Authorization: Bearer JWT
      v
Express API (Node.js / Render)
      +--> Mongoose --> MongoDB Atlas (data and GridFS clothing photos)
      +--> Hugging Face pretrained try-on Spaces (AI photos, with consent)
```

The AI provider token is used only by the Express backend; it is not exposed through React or `VITE_*` variables. Private saved wardrobe data is scoped to the authenticated user's ID.

## Run locally

Requirements: Node.js 22 (recommended), npm, and a MongoDB Atlas database connection.

1. Clone the repository:

```bash
git clone https://github.com/Talaelzein/StyleCircle.git
cd StyleCircle
```

2. Create `server/.env` based on `server/.env.example`:

```dotenv
PORT=3000
MONGO_URI=YOUR_PRIVATE_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
HF_TOKEN=YOUR_PRIVATE_HUGGING_FACE_TOKEN
```

`HF_TOKEN` is necessary only for the external AI try-on. Do not commit real secrets.

3. Start the Express API in one terminal:

```bash
cd server
npm ci
npm run dev
```

4. In a second terminal, configure `client/.env` based on `client/.env.example` (`VITE_API_URL=http://localhost:3000`) and start React:

```bash
cd client
npm ci
npm run dev
```

5. Open the Vite URL shown by the terminal, generally `http://localhost:5173`. You may create a new account using the signup page.

### Production configuration

- **Vercel:** deploy the `client` directory, build using `npm run build`, and set `VITE_API_URL` to the public Render backend origin.
- **Render:** deploy the `server` directory using `npm start`; set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (your Vercel production origin) and `HF_TOKEN` as server environment variables.
- The SPA rewrite in `client/vercel.json` supports refreshing nested React routes.

## API overview

| Method / route | Description |
| --- | --- |
| `GET /api/health` | Public API health response |
| `POST /api/auth/signup` | Create account |
| `POST /api/auth/login` | Authenticate and receive JWT |
| `GET /api/auth/me` | Get current authenticated user |
| `GET/POST /api/clothing-items` | List or create clothes |
| `GET/PATCH/DELETE /api/clothing-items/:id` | View, edit or delete clothing (409 when referenced by a saved outfit) |
| `GET/POST /api/outfits` | List or create outfits |
| `GET/PATCH/DELETE /api/outfits/:id` | View, edit or delete outfit |
| `GET/POST /api/fitchecks` | Community FitCheck polls |
| `PUT /api/fitchecks/:id/vote` | Cast one final vote (409 if a second, different choice is attempted) |
| `GET/POST/PATCH/DELETE /api/entries...` | Planner, wear logs, packing, wishlist and moodboards |
| `POST /api/suggestions/generate` | Generate rule-based outfit suggestions |
| `POST /api/try-on` | Generate AI try-on via an authenticated backend proxy |

Most resource endpoints require `Authorization: Bearer <JWT>`; see `server/src/routes/` and the Postman collection for complete request shapes.

## Tests and verification

GitHub Actions runs frontend unit tests and build checks, backend security/algorithm tests, and MongoDB-backed API integration tests using a disposable MongoDB service.

```bash
# In client/
npm ci
npm test
npm run build

# In server/
npm ci
npm test
# To run the database integration tests as well, start a disposable MongoDB
# instance locally and set TEST_MONGO_URI=mongodb://127.0.0.1:27017/stylecircle_ci
```

- [Testing and acceptance checklist](docs/testing.md)
- [Final remediation review and regression-test evidence](docs/remediation.md)
- [Additional strict-grading findings and what has been addressed](docs/additional-grading-findings.md)
- [Presentation and technical Q&A guide](docs/presentation-guide.md)
- [Postman Milestone 2 collection](postman/StyleCircle_Milestone2.postman_collection.json)

## Capstone documentation

- [Milestone progress and commit evidence](docs/milestones.md)
- [Wireframes](docs/wireframes.md)
- [Current MongoDB database schema](docs/database-schema.md)
- [Design system](docs/design-system.md)

The `README_FIRST.md` file is historical setup material from an earlier prototype and may describe now-superseded fitting-room behavior. This root README documents the current deployed AI Studio.

## Known limitations

- Public Hugging Face models depend on GPU queues and quota; a successful prior result may be shown during demonstrations when live generation is temporarily unavailable.
- AI-generated images can change appearance details and do not guarantee physical garment fit.
- Imported and generated try-on preview images are stored in the current browser (IndexedDB) where supported, not automatically synced across accounts/devices.
- The app uses selected weather preferences for styling suggestions; it does **not** fetch live weather automatically.
- The project is an educational capstone, not a production-scale paid inference service.

For the final release review, see [full-mark acceptance criteria](docs/full-mark-acceptance.md).
