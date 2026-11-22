# Drive-around 3D portfolio

A cozy low-poly island you explore by car. Built with Three.js (3D), Rapier (physics) and Vite.

## Edit your content
Everything personal lives in `src/content.js` — name, title, links, and the five zones
(About, Experience, Projects, Skills, Contact). Change positions there to move zones around.

## Run locally
```
npm install
npm run dev
```

## Deploy
Push to GitHub, then import the repo on vercel.com. Vercel detects Vite automatically
(build command `npm run build`, output folder `dist`).

Controls: WASD / arrows, Shift boost, Space brake, R reset. Touch buttons on phones.
There is also a plain "Résumé" view (top-right button) for recruiters who just want the facts.
