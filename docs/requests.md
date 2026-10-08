# Cross-team requests

Use this file when you need something from the other side's folders. Newest first.
Format: `- [open|done] YYYY-MM-DD HH:MM · from A|B → to A|B · what · why`

- [open] 2026-10-08 12:16 · from A → to B · Staff "Mail tracker" page: embed the Mailpit UI (`SystemStatusDTO.mailpitUrl`, default http://localhost:8025) in an iframe, beside a list from `GET /api/staff/mail-tracker` (filter by applicant, direction badge in/out, a "redirected by safe mode" badge when `originalTo` ≠ `to`). Also link "View in tracker" from the applicant's Emails view · the user wants Mailpit kept as the mail tracker inside the product
- [open] 2026-10-08 · from A → to B · Vite dev server must proxy `/api` and `/socket.io` (ws: true) to `http://localhost:3000` · API uses the global prefix `/api`, and the socket is on the same origin
- [open] 2026-10-08 · from A → to B · Alias `@educaro/shared` to `../../packages/shared/src/index.ts` in vite.config and tsconfig paths · the web consumes shared as source, and only the API uses the compiled `dist`
