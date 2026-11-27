# StyleCircle — Presentation and Q&A checklist

This is a preparation guide, **not** evidence of how a past oral presentation went.

## Efficient live demo

1. Open the public StyleCircle frontend in a private browser and sign in.
2. Show the user-owned wardrobe and its saved clothing photos.
3. Create a temporary outfit from two items and demonstrate that it is saved after refresh.
4. Show FitCheck: users choose between two looks, cannot vote on their own poll, results are hidden from visitors before voting, and the first vote is final.
5. Show Mix & Match's rule-based recommendations and the AI Style Studio (pre-generated example only if external GPU quota is unavailable; explain it transparently).
6. Show mobile viewport and the API health endpoint. Keep the GitHub README and documentation ready.

## Short technical Q&A

**Where is the data stored?** User accounts, outfits, wardrobe items, polls and style entries are persisted in MongoDB Atlas via Mongoose. Clothing photos use MongoDB GridFS; some AI preview images are stored locally in browser IndexedDB.

**How is a user's private wardrobe protected?** Express routes require a signed JWT and scope every private query to the authenticated `req.userId`. The frontend also protects its private routes.

**How do you stop a user voting on their own FitCheck?** The FitCheck voting route checks `String(poll.ownerId) === String(req.userId)` and returns **403 Forbidden**. `bcrypt.compare()` is for checking passwords during authentication, **not** for stopping self-votes.

**Can someone vote more than once?** MongoDB enforces a unique compound index on `(fitCheckId, voterId)`. The server inserts once and rejects changes with **409 Conflict**, including competing requests.

**What happens if someone deletes clothing used in an outfit?** The backend checks referenced saved outfits and blocks the deletion with **409**, so the outfit remains valid. Photos embedded in previously shared FitCheck snapshots are protected against file cleanup.

**How are vote totals hidden before voting?** The API itself withholds the totals (`votes: null`), not just the React interface. Voters and poll owners can view totals; final totals become public after a poll closes.

**What does the AI model do?** The backend forwards explicitly supplied try-on photos to external pretrained Hugging Face model services. It renders approximate front-view imagery, not precise garment sizing, and live execution depends on third-party GPU quota.

**How do you know it runs?** GitHub Actions runs frontend tests/build and database-backed API regression tests; the public Vercel and Render deployment are separately checked in the browser. CI does not guarantee hosting uptime.

## Honest contingencies

- If the AI service is quota-limited, show a previously generated genuine example and state that it was generated earlier.
- Never claim a 360-degree garment simulation or accurate sizing.
- For demonstrations after a deployment, verify signup/login, image persistence and the backend health endpoint again.

## Rehearsable 7-minute oral presentation (adapt to professor's time limit)

| Time | On-screen evidence | Spoken point |
| --- | --- | --- |
| 0:00–0:45 | Homepage | “StyleCircle solves a practical problem: people own clothes but waste time deciding what to wear. It combines closet organization, outfits, community feedback and an optional AI preview.” |
| 0:45–1:30 | Architecture | “React renders the UI. Express validates and authorizes requests. MongoDB stores user data; GridFS stores private clothing photos. Vercel and Render host the client and API.” |
| 1:30–2:25 | My Closet | Show a disposable item, editable fields, private photo upload, and persistence after page refresh. Explain JWT authorization. |
| 2:25–3:15 | Saved Outfits / Mix & Match | Create a two-item outfit, save it, and explain how rule-based recommendations differ from the separately hosted AI model. |
| 3:15–4:10 | FitCheck | Compare two saved outfits. Sign in as a second voter; show hidden results before voting and visible results afterward. Explain the unique database index and self-vote protection. |
| 4:10–4:55 | Planner / Packing / Insights | Demonstrate a scheduled outfit, packing checklist and usage/cost-per-wear statistics. |
| 4:55–5:45 | AI Style Studio | Explain the external pretrained Hugging Face model, its image-based front-view output and its GPU availability limits. Show a genuine earlier generated sample if live generation is quota-limited. |
| 5:45–6:30 | GitHub Actions + API health | Point out MongoDB-backed tests, Chromium browser checks, axe accessibility, npm audit and the deployed endpoint. |
| 6:30–7:00 | Conclusion | Summarize value and acknowledge that AI output is approximate, not true-to-size or a guaranteed 360-degree garment simulation. |

### Strong technical answers

**Where is CRUD implemented?** The Express clothing, outfit, entry and FitCheck routes expose create, read, update and delete operations, consumed by the React frontend.

**Why validate on the backend?** Client-side HTML validation can be bypassed. Zod restricts payloads before they reach MongoDB.

**How are user records kept private?** Authenticated routes verify a signed JWT and filter database operations by the token-derived user ID; outfit creation verifies ownership of every clothing item.

**How are concurrent votes limited?** MongoDB's unique composite index on FitCheck and voter identifiers prevents duplicate vote rows; the first choice remains final.

**What does HTTP 409 indicate?** A conflict with the current state, such as attempting to delete clothes still in saved outfits, deleting an actively planned outfit, or changing a final FitCheck vote.

**Why GridFS?** Clothing images remain private in MongoDB and are delivered through authenticated image endpoints. FitCheck photos may be explicitly shared with signed-in community members.

**What proves the application works?** The GitHub Actions suite exercises React tests/build, API tests against disposable MongoDB, browser flows, accessibility checks and dependency audits. Production availability is checked separately.

**How do you handle AI quota limits?** The frontend displays a useful error and can display an authentic previously generated result; the presentation must disclose that result is not a live generation.

### Presentation readiness checks

- Use a demo account, never expose tokens, environment variables or personal photos on the projector.
- Prepare two saved outfits and a second account to demonstrate community voting.
- Verify API health, live application login and wardrobe photos before the oral demonstration.
- Keep a real previously generated AI preview as an honestly labeled fallback.
- Rehearse the full flow with a timer and keep the latest passing GitHub Actions run available.
- A professional oral defense is assessed on delivery and answers, not merely the existence of slides.

