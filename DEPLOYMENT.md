# Yacht Dice Deployment

## 1) Server Deploy (Render)
1. Push this repository to GitHub.
2. In Render, create a new Blueprint service and select this repo.
3. Render will read `render.yaml` and create:
   - `yacht-dice-server` (Web Service)
   - `yacht-dice-web` (Static Site)
4. After first deploy, open `yacht-dice-server` and copy its public URL.
5. Open `yacht-dice-web` -> Environment and set:
   - `VITE_SERVER_URL=https://<your-server-url>`
6. Redeploy `yacht-dice-web`.

## 2) Web Deploy (Vercel alternative)
If you want Vercel for frontend instead of Render static site:
1. Import this repo in Vercel.
2. Vercel uses `vercel.json`.
3. Set environment variable:
   - `VITE_SERVER_URL=https://<your-server-url>`
4. Deploy.

## 3) Post-deploy Checks
1. `GET /health` on server returns `{ "ok": true }`.
2. Web opens without API/CORS error.
3. Two mobile devices can join same room and play realtime.
4. Home screen install works (PWA standalone launch).

## Notes
- Current server stores data in `apps/server/data/db.json` (file-based). On free hosting, data may reset on restart/redeploy.
- For persistent production data, migrate to external DB (Postgres/Supabase).
