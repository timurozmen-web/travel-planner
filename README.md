# Journeys Planner

Trip planner: route map, day plans, budgets, hotel loyalty and Avios, with Unsplash photos.

- `public/` — the static app (index.html plus map tiles, city list and logos)
- `netlify/functions/photos.mjs` — `/api/photos?q=` Unsplash search, CDN-cached for a week
- `netlify/functions/photo-used.mjs` — tells Unsplash when a photo is chosen as a cover

Set `UNSPLASH_ACCESS_KEY` (Functions scope) in Netlify, then deploy. No build step.

Map data: Natural Earth (public domain). City list: GeoNames (CC BY 4.0).
