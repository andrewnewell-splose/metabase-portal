# Dashboard Portal (shared)

A single launchpad for your Metabase & Pipedrive dashboards and questions. Tiles are stored
centrally, so anything one person adds is seen by everyone. Anyone with the link can
view; adding or editing requires a shared team passcode.

## Files

- `index.html` - the portal page
- `api/data.js` - the shared list (read/write), backed by Upstash Redis
- `api/mb-name.js` - looks up a question/dashboard's real name from Metabase

## One-time setup on Vercel

1. Deploy the project (drag the folder into Vercel, or run `npx vercel` then
   `npx vercel --prod` from this folder). You get a live URL.

2. Add the database. In your project on vercel.com, open the **Storage** tab, choose
   **Redis (Upstash)** from the Marketplace, and create a database on the free plan.
   Accept the prompt to connect it to this project. This injects the connection
   credentials as environment variables automatically (no copying needed).

3. Set the team passcode. Go to **Settings > Environment Variables** and add:
   - `PORTAL_ADMIN_KEY` = any phrase you choose. Share it only with people allowed
     to edit. Without it set, the portal is view-only for everyone.

4. Redeploy so the new variables take effect: run `npx vercel --prod` again, or in the
   Git workflow just push any small change.

That's it. Open the URL, click **Unlock to edit**, enter the passcode, and add tiles.
Everyone else sees them immediately (a tab refresh or revisit pulls the latest).

## Optional: names for internal (login-only) reports

Public links name themselves with no setup. To auto-name internal dashboards/questions,
add a Metabase API key as an environment variable named `METABASE_API_KEY` (create one
in Metabase: Admin > Settings > Authentication > API keys). Without it, internal tiles
use their URL slug or whatever name you type.

## How it works

- The page reads the list from `/api/data` (same origin, so no CORS).
- Edits POST to `/api/data` with the passcode in an `x-portal-key` header. The function
  checks it against `PORTAL_ADMIN_KEY`, applies the single change to the stored JSON in
  Redis, and returns the updated list. The Redis token never reaches the browser.
- The passcode is remembered in the editor's browser so they don't retype it each time.

## Changing the default seed

If Redis is empty, the function serves a default list (see `DEFAULT_DATA` in
`api/data.js`). Once anything is saved, the stored list takes over.
