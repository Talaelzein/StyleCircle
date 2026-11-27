# StyleCircle — Capstone Report Findings and Remediation

This note maps the strict report's technical findings to changes in the review branch. It separates genuine code faults from unsupported claims and records what remains dependent on real hosting or oral assessment.

| Finding | Action |
| --- | --- |
| Deleting clothing can invalidate saved outfits | Deletion now returns HTTP 409 for clothing still included in a saved outfit; the React wardrobe shows the server's specific explanation. |
| Shared FitCheck pictures could disappear on clothing deletion | Reuse the GridFS retention check; photos referenced by a FitCheck snapshot remain stored. |
| Vote results visible before participation | The API returns `votes: null` for an open poll viewed by a nonowner who has not voted, and exposes a `canViewResults` flag; the UI hides totals until participation. Owners always see totals and closed polls show results. |
| Existing vote can change | First accepted vote is final; the server uses a unique index and atomic upsert, and returns 409 when a different choice is submitted. The UI hides voting buttons after voting. |
| `@gradio/client` missing from manifest | **Not reproducible:** `server/package.json` already declares `@gradio/client: ^2.8.0`; the lockfile is consistent, so no dependency changes were necessary. |
| Excessively large modules | Extracted the FitCheck card, wardrobe picker, and old FASHN image endpoint implementation into separate modules without removing previously available routes. |
| Inconsistent feature styling | The outfit picker uses shared editorial design tokens, and the poll card adopts consistent surface, status and focus styling. Additional visual/accessibility review is still possible. |
| Insufficient database-backed tests | GitHub Actions starts temporary MongoDB and runs `server/tests/databaseIntegration.test.js` in addition to existing frontend and backend tests. |
| README / historical documentation | Updated current README, database schema, design notes and testing directions; clearly marked earlier prototype README as archived. |
| Mobile / live deployment / AI uptime | Previously checked on the `master` release by the project owner; **must be retested on the new deployment after merge**. External AI queues/quota remain outside our control. |
| Presentation score | Cannot be fixed by a code change or independently graded without watching the oral demonstration. The correct self-vote explanation is comparing `poll.ownerId` to `req.userId`, returning HTTP 403—not `bcrypt.compare`, which is for passwords. |

## Verification policy

- Automated unit tests and build: `client/npm test`, `client/npm run build`, `server/npm test`.
- Database integration runs in CI using a disposable container; no actual user wardrobe is modified by tests.
- Public Vercel and Render checks need to be performed after the PR merges/deploys.
- A working deployment and oral presentation grade cannot be guaranteed by the CI system.
