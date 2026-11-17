# Journeys Planner

Trip planner: route map, day plans, budgets, hotel loyalty and Avios, with Unsplash photos.

- `public/` — the static app (index.html plus map tiles, city list and logos)
- `netlify/functions/photos.mjs` — `/api/photos?q=` Unsplash search, CDN-cached for a week
- `netlify/functions/photo-used.mjs` — tells Unsplash when a photo is chosen as a cover
- `netlify/functions/ai.mjs` — `/api/ai`, Claude through Netlify AI Gateway (city research, travel planning, stopovers), streamed
- `netlify/functions/sync.mjs` — `/api/sync`, trips saved in Netlify Blobs under a private sync code
- `netlify/functions/upload.mjs` — `/api/upload`, your own stop photos, stored in Blobs
- `netlify/functions/share.mjs` — `/api/share`, view-only trip links (`/?trip=<id>`), kept up to date as the owner edits

Set `UNSPLASH_ACCESS_KEY` (Functions scope) in Netlify, then deploy. No build step. AI Gateway needs a credit-based Netlify plan; `PLANNER_MODEL` overrides the model.

Map data: Natural Earth (public domain). City list: GeoNames (CC BY 4.0).
