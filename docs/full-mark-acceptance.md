# StyleCircle — Full-mark acceptance criteria

The capstone rubric has six categories. These are concrete acceptance criteria for a release review, not a prediction of the professor's score. Use the GitHub Actions run for the exact candidate commit and separately verify the public deployment.

| Rubric | Acceptance evidence |
| --- | --- |
| Functionality (30) | Real browser signup/login/logout, owned wardrobe creation/edit/deletion and refresh, outfit creation/persistence and safe deletion, multi-account FitCheck voting and results privacy, API-backed supporting screens, and an actual external AI generation or clearly disclosed saved example. |
| Code quality (20) | Focused React components, route/service/utility separation, readable JSX, shared validation and styling, reproducible builds, understandable error paths. Do not equate a high score with a particular maximum line count. |
| Design & UX (15) | Consistent visual design, mobile viewport screenshots for the core pages, no horizontal page overflow, labeled inputs, focus visibility, usable keyboard controls and manual device/assistive-technology checks. |
| Security & testing (15) | bcrypt/JWT, ownership enforcement, Zod and upload signature validation, quotas, CI unit + connected MongoDB tests, browser tests, mocked external-provider success/failure tests, and npm audit results. Automated scans do not establish complete security. |
| Documentation (10) | Correct live URLs and local setup, schema, feature/API details, current limitations, actual milestone commit evidence and test instructions. Past milestone chronology may not be fabricated. |
| Presentation (10) | Demonstrate the deployed application, explain the request/data flow, answer technical questions and disclose limits of external AI. See the presentation guide. Only an actual demonstration can establish oral performance. |

## Evidence added by this candidate

- The AI request route rejects spoofed image bytes before contacting the provider. The shared signature utility checks the encoded format; it is not a complete image decoder.
- The AI provider boundary test uses an isolated fake Gradio client to test successful output, invalid uploads, unsupported categories, quota exhaustion and safe server errors. It does not use live AI credits or assert that third-party inference ran.
- The Studio preview was extracted into a component; the import file input is keyboard-operable and narrower mobile preview grids can shrink to their container. Shared clothing-form JSX was reformatted with the original field behavior preserved.
- The browser suite drives the wardrobe and outfit interfaces instead of merely creating an item directly through HTTP, tests blocked deletion, tests final voting with another account, and records accessibility and mobile evidence across authenticated screens.
- Review the actual CI artifacts for any accessibility findings or overflow. Additional-screen scans are an inventory; they are not a claim of WCAG conformance. Signup and Home retain the serious/critical accessibility gates.

## Production sign-off (to be performed on the final merged revision)

Record the exact release commit, date, device/browser and each observed result. Do not mark unperformed steps passed.
- Public frontend and API health, then signup, logout and login in a fresh browser.
- Create, edit, upload, refresh and delete a disposable garment; create/edit/delete a saved outfit.
- Attempt deletion of a referenced garment, then remove the reference and retry.
- Verify two-account FitCheck voting, results visibility and shared pictures.
- Navigate every feature; check console and network errors.
- Test on a physical phone, tablet and desktop, plus keyboard navigation and zoom.
- Try AI generation only with an available quota and explicit consent; record any external failure separately.
