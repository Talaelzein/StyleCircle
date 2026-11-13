# StyleCircle - Full-Stack Capstone Starter (through Milestone 2)

Team: Ingrid Barza · Tatiana Ibrahim · Tala El Zein

A social digital wardrobe app. This starter includes a React/Vite client scaffold and a **working Express + MongoDB backend** with signup, login, JWT-protected routes, wardrobe CRUD, validation, and ownership controls. The outfit builder, outfit polls, image uploads, and frontend-to-backend integration are **future work** (Milestone 3 and later).

## What counts as Milestone 2 (Session 21, professor's slide 3)

- Authentication: signup, login, bcrypt password hashing, JWT; protected routes require `Authorization: Bearer <token>`; missing/invalid token -> **401**.
- CRUD: create, list, read one, update, and delete clothing items in MongoDB.
- Owner isolation: all clothing queries are restricted by the authenticated user's ID. A user trying to retrieve/edit/delete another person's clothing item receives **404**.
- Appropriate statuses: **201** on creation, **400** for invalid data/IDs, **404** for missing/other users' items, **409** for duplicate email, **500** for unexpected server errors.

## Before you start

- Node.js 20+ and npm installed. Confirm with `node -v` and `npm -v`.
- MongoDB Atlas account and a database cluster. Use an Atlas database user, the Atlas connection string, and an IP allow-list entry for your development machine.
- VS Code (or equivalent), Postman/Thunder Client, and Git.

### Step 1 - Set environment variables

In PowerShell, from the root of the unzipped project:

```powershell
cd server
Copy-Item .env.example .env
notepad .env
```

Fill in all the values in `server/.env`:

```env
PORT=3000
MONGO_URI=mongodb+srv://YOUR_DB_USER:YOUR_URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/stylecircle?retryWrites=true&w=majority
JWT_SECRET=YOUR_OWN_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
CLIENT_ORIGIN=http://localhost:5173
```

**Important:** Replace the placeholders. Never send, screenshot, or commit your `.env`, database password, or JWT secret. If your password contains symbols, URL-encode those symbols in the MongoDB URI. On some connections Atlas provides additional URI parameters; keep the exact URI Atlas gives you.

### Step 2 - Install and run the backend

```powershell
# inside server/
npm install
npm run dev
```

You should see `MongoDB connected` and `StyleCircle API listening on http://localhost:3000`.

Open `http://localhost:3000/api/health` in a browser. Expected JSON:

```json
{ "status": "ok", "app": "StyleCircle API" }
```

If it fails: check `server/.env` values, Atlas network access, database credentials, and that another program isn't using port 3000.

### Step 3 - Install and run the client scaffold (Milestone 1 foundation)

In a **second terminal**, from the unzipped project root:

```powershell
cd client
npm install
npm run dev
```

Visit `http://localhost:5173`. It displays a **placeholder scaffold**, NOT a working wardrobe UI yet. Connecting the UI to the API is Milestone 3.

## Step 4 - Test the API (Postman / Thunder Client)

The easiest option is to import `postman/StyleCircle_Milestone2.postman_collection.json` into Postman. Its `baseUrl` is `http://localhost:3000`, and it saves the JWT from the login request to a collection variable named `token`.

Run requests in this order:

1. `Health` -> 200.
2. `Signup` -> 201, user and JWT. If you repeat with the same email -> 409 (this is correct). Use a new email or log in.
3. `Login` -> 200 and sets token automatically.
4. `My profile (protected)` -> 200 with token; without it -> 401.
5. `Create clothing item` -> 201; note the returned `_id` and place it in collection variable `itemId` (collection script saves it automatically).
6. `List my clothing` -> 200, item appears.
7. `Read clothing item` -> 200.
8. `Update clothing item` -> 200, changed name/color.
9. `Delete clothing item` -> 204, no body.
10. `Read clothing item` again -> 404.

### Prove ownership (professor's 'Bob can't touch Alice's data' check)

- Log in as **Alice**, create an item, copy its `_id` and Alice's token.
- Sign up/log in as **Bob**, use Bob's token to `GET`, `PATCH`, or `DELETE /api/clothing-items/<AliceItemId>`.
- Each attempt must return **404**. Bob's `GET /api/clothing-items` must NOT list Alice's item.

### Security checks

- No header -> 401.
- Header `Authorization: Bearer badtoken` -> 401.
- `POST /api/clothing-items` with empty name, invalid category, or `ownerId` in request body -> 400.
- Any other user's object ID -> 404.
- Wrong login password -> 401 with generic message (doesn't reveal which email exists).

## API reference

| Method | Path | Purpose | Authentication |
|---|---|---|---|
| GET | `/api/health` | Verify server starts | Public |
| POST | `/api/auth/signup` | Create account | Public |
| POST | `/api/auth/login` | Login, return JWT | Public |
| GET | `/api/auth/me` | Current user's profile | Bearer JWT |
| GET | `/api/clothing-items` | List your items; optional `?category=top&search=shirt` | Bearer JWT |
| GET | `/api/clothing-items/:id` | View one of your items | Bearer JWT |
| POST | `/api/clothing-items` | Create item | Bearer JWT |
| PATCH | `/api/clothing-items/:id` | Update item fields | Bearer JWT |
| DELETE | `/api/clothing-items/:id` | Remove item | Bearer JWT |

Signup body:

```json
{ "username": "Alice", "email": "alice@example.com", "password": "ExamplePass123!" }
```

Login body:

```json
{ "email": "alice@example.com", "password": "ExamplePass123!" }
```

Clothing item body (`imageUrl` is optional, not an upload implementation):

```json
{ "name": "White shirt", "category": "top", "color": "white" }
```

Allowed categories: `top`, `bottom`, `dress`, `outerwear`, `shoes`, `bag`, `accessory`. Do not include `ownerId`; the server gets it from the validated JWT. User-supplied photo URLs are only a **temporary placeholder**; actual Cloudinary upload is scheduled for later.

Update body example:

```json
{ "name": "White linen shirt", "color": "ivory" }
```

Success response for a new item includes its `_id`, `ownerId`, `name`, `category`, `color`, `imageUrl`, `createdAt`, `updatedAt`. Deleting returns `204 No Content`.

## Automated baseline tests

In separate terminals, with dependencies installed:

```powershell
cd server
npm test
```

```powershell
cd client
npm test
```

These tests check the health API, protected requests with no JWT, and the React scaffold. **They do not replace manual MongoDB CRUD and two-user ownership testing**. More thorough functionality tests should be added as the app develops.

## Schema and wireframes

See `docs/database-schema.md` and `docs/wireframes.md`. The backend implements **Users** and **ClothingItems** first. **Outfits**, **Polls**, and **Votes** are documented for later milestones, as in the approved/approval-pending proposal.

## GitHub checkpoint

At the root of the project:

```powershell
git init
git add .
git commit -m "Milestone 2: authenticated wardrobe CRUD API"
```

Before pushing, run `git status` and ensure `.env` and `node_modules/` are not staged. Add the GitHub remote (from your team's shared repository) and push. For collaboration, each teammate can create a feature branch and submit a pull request. Keep your Milestone 2 work as a visible commit.

## Next (not part of Milestone 2)

- React forms/pages to call this backend (Milestone 3).
- Cloudinary uploads with secure server-controlled image metadata.
- Outfit composition and two-outfit poll voting; enforce a unique `(pollId, voterId)` database index.
- More tests, performance improvements, frontend/backend deployment, and 5-8 minute presentation.
