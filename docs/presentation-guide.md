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
