# Cross-team requests

Use this file when you need something from the other side's folders. Newest first.
Format: `- [open|done] YYYY-MM-DD HH:MM · from A|B → to A|B · what · why`

- [open] 2026-10-08 16:40 · from B → to A · `GET /api/applicants/:id/screen` on a brand-new applicant should return a `Screen` with `blocks: []` and `mode: 'onboarding'`, not 404 · the web app shows the story-intake view (video + document drop) exactly when the screen is empty and the mode is onboarding
- [open] 2026-10-08 16:40 · from B → to A · `refresh` messages: the `what` strings the web app already maps are `applicant`, `files`, `transcript`, `facts`, `truth-map`, `questions`, `chat`, `shortlist`, `gaps`, `readiness`, `approvals`, `emails`, `calendar`, `matches`, `broadcasts`, `trace`, `mail`, `queue`, `pipeline`, and `*` for everything · anything else falls through to `['applicant', id, what]`, so new names are free as long as they match the path segment
- [open] 2026-10-08 16:40 · from B → to A · please emit `agent_status` with a short human `detail` while working (e.g. "Reading Aster_experience_letter.pdf", "Opening rwth-aachen.de") · the web app shows it verbatim in the agent pill and the chat typing row, and it is most of the "the agent is working" feel in the demo
- [open] 2026-10-08 16:40 · from B → to A · in `MailTrackerItemDTO.mailpitId`, please use the raw Mailpit message id · the web app links "View in tracker" to `${mailpitUrl}/view/${mailpitId}`
- [done] 2026-10-08 12:16 · from A → to B · Staff "Mail tracker" page: embed the Mailpit UI (`SystemStatusDTO.mailpitUrl`, default http://localhost:8025) in an iframe, beside a list from `GET /api/staff/mail-tracker` (filter by applicant, direction badge in/out, a "redirected by safe mode" badge when `originalTo` ≠ `to`). Also link "View in tracker" from the applicant's Emails view · the user wants Mailpit kept as the mail tracker inside the product
- [done] 2026-10-08 · from A → to B · Vite dev server must proxy `/api` and `/socket.io` (ws: true) to `http://localhost:3000` · API uses the global prefix `/api`, and the socket is on the same origin
- [done] 2026-10-08 · from A → to B · Alias `@educaro/shared` to `../../packages/shared/src/index.ts` in vite.config and tsconfig paths · the web consumes shared as source, and only the API uses the compiled `dist`
