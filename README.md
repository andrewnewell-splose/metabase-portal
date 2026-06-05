# Dashboard Portal

A single-page launchpad for your Metabase dashboards and questions. Add a link once
(full URL or just an ID), and it becomes a permanent tile with search, pinning, and
categories. Everything is saved in the browser, so each person curates their own set
on top of the shared starting tiles baked into the page.

## Files

- `index.html` — the portal (works on its own)
- `api/mb-name.js` — optional Vercel function that fetches the real name of a
  question/dashboard so tiles can name themselves

## Deploy to Vercel

From this folder:

```bash
npx vercel        # first run links/creates the project and gives a preview URL
npx vercel --prod # promote to your production URL
```

Or drag this folder into the Vercel dashboard. Vercel serves `index.html` as the site
and turns `api/mb-name.js` into a function at `/api/mb-name` automatically. No build
step or config needed.

## Automatic names

When you add a tile and leave the name blank, the page asks `/api/mb-name` for the real
title and fills it in.

- **Public links** (`/public/question/...`, `/public/dashboard/...`) resolve with no
  extra setup.
- **Internal links/IDs** need a Metabase API key so the function can read them. Set it
  in Vercel under Project > Settings > Environment Variables:
  - `METABASE_API_KEY` — create one in Metabase: Admin > Settings > Authentication > API keys
  - `METABASE_BASE_URL` — only if your Metabase URL differs from the default
- Full internal links that include a slug (e.g. `/dashboard/42-revenue-overview`) are
  named from the slug even without the key.

If a name can't be fetched, the tile keeps whatever you typed, and you can always rename
it with the edit (pencil) button.

## Changing the shared starting tiles

The baked-in tiles everyone sees live in the `SEED` constant near the top of the
`<script>` in `index.html`. Edit that list and redeploy to update the defaults for new
visitors.
