# StyleCircle — Additional Strict-Grading Findings (Nov 27, 2026)

A separate reviewer produced a **provisional** score of 73/100. That score is not an observed professor grade. This document records the claims behind the score and how the repository was checked or improved.

| Review concern | Evidence / remediation | Remaining qualification |
| --- | --- | --- |
| No end-to-end or database-backed tests | PR #3 adds real MongoDB-backed API tests for authorization, concurrent final voting, uploads, references and photo retention. Follow-up PR #4 adds Chromium browser E2E against a local full-stack app. | External Hugging Face inference is not deterministic and requires a separately checked account/quota; CI does not guarantee production uptime. |
| Large / compressed core components | PR #3 extracts the FitCheck card, clothing picker and legacy AI image routes. PR #4 extracts Saved Outfits and AI Studio storage / selection helpers and tests them. | Not every file is small; readability is evaluated by responsibility, not just line count. |
| Accessibility unverified | Browser/axe scans and a mobile viewport are included in CI. Authentication fields have labels and category accessible names match visible text. | No automatic check replaces all keyboard, assistive-technology and real-device testing. |
| npm audit reports critical Vitest / Tinypool issues | Vitest upgraded from 3.2.4 to 5.1.2, with compatible Vite 6.4.6 and regenerated npm lockfiles; CI enforces no high/critical advisories. | New advisories can arise later; rerun audit when preparing another release. |
| README outdated or contradictory | Current root README includes deployed links, accurate AI limitations and data integrity; historical `README_FIRST.md` is explicitly archived. | Root README is authoritative over historical prototype notes. |
| No historical milestone tags; M1/M2 share one initial commit | Genuine commit links and clearly labeled short public milestone updates are documented in `docs/milestones.md`. | Distinct past tags and the exact past posting dates cannot be recreated honestly. Professor instructions permit short updates as an alternative. |
| Missing presentation evidence | `docs/presentation-guide.md` includes a step-by-step live demo and technical Q&A. A PowerPoint slide deck has also been prepared for the project owner. | The actual oral performance cannot be measured from a GitHub repository; no score is guaranteed. |
| No independent public deployment checks | The project owner tested login, wardrobe persistence, mobile layout, console and API health in Incognito before these changes. | After merging the new code, run the same production smoke tests again to verify the current release. |

## Grading weights (professor rubric)
Functionality 30; code quality & organization 20; design & UX 15; security & testing 15; documentation 10; presentation 10.

## Evidence discipline
- Do not claim a 100/100 or imply an evaluator saw a presentation that was not recorded.
- Do not claim AI body-size accuracy or 360-degree garment generation.
- Keep the GitHub Actions record of the latest successful test/build/dependency audit and perform a separate public-browser check.
- Preserve historical milestone records instead of fabricating earlier tags.
