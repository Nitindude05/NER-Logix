# GPS Tracking — React + Tailwind conversion

Converted from the original vanilla-JS project. `backend/` is your
original Node/Express API, **unchanged** except that it no longer serves
`track.html` / `admin.html` — those two pages are now one React app.

- `backend/` — Express + SQLite API (`POST /set`, `GET /get`), same as before.
- `frontend/` — Vite + React + Tailwind app with two tabs:
  - **Track** — what `track.html` did: sends this browser's GPS position to
    `POST /set` every 3 seconds.
  - **Fleet** — what `admin.html` did: polls `GET /get` every 3 seconds and
    now actually renders the results (the original just `console.log`'d
    them) as a live list + radar-style map.

## Run it

**Terminal 1 — backend (port 8888):**
```
cd backend
npm install
npm start
```

**Terminal 2 — frontend (port 5173):**
```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. In dev, Vite proxies `/set` and `/get` to the
backend on `:8888`, so no CORS setup is needed. For production, run
`npm run build` in `frontend/` and serve the resulting `dist/` folder from
Express (or any static host), keeping the API on the same origin.

## Notes

- If the backend isn't running, the app doesn't just break — it falls back
  to a small local simulation (two demo devices) so you can still see the
  UI working, with a "local simulation" badge instead of "live api".
- `src/GpsTracker.jsx` is the whole converted UI — a single component with
  the two tabs described above.
