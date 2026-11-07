# Plate

A dish-level dining journal built retroactively from your photos. Pick photos from the last
12 months and Plate finds the food shots with a location, groups them into meals, proposes the
restaurant, and lets you confirm each one with a swipe. Later it resurfaces what you loved and
answers "where should I eat near X?" using only your own log.

This is a **front-end-only prototype**: React + Vite + TypeScript, local-first, no accounts, no
backend. A Supabase backend is planned and the data layer is built to swap to it (see
[Architecture](#architecture)).

## Setup

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # unit tests (vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

### Try it without photos: demo mode

Open the **Import** tab, scroll to **Settings** and switch on **Demo mode**. It loads 25
fictional meals at fictional restaurants across about 16 NYC neighborhoods, plus four cards in
the triage queue so you can try the swipe flow. Turning it off removes only the demo data.
Demo photos are generated placeholder tiles, so nothing real is involved.

### Try it with real photos

Import tab → **Choose photos** (or **Choose a folder** in Chromium). Only photos that carry GPS
data and were taken in the last 12 months are considered. The first scan downloads a
food-recognition model once (see Privacy).

## Features

| Tab | What it does |
| --- | --- |
| **Import** | Pre-import privacy explanation, photo/folder picker, scan progress, triage queue count, settings (demo mode, venue lookup toggle, erase data). |
| **Triage** (from Import) | Card stack. Swipe right to confirm, left to skip, down for "not a restaurant meal". Pick a different candidate or type a name. After confirming, rate it (required), optionally add dishes with "order again" flags, a note, companions and a price feel. Arrow keys and buttons work too. Skip and dismiss can be undone. |
| **Journal** | Reverse-chronological meals, searchable by venue, neighborhood or dish. Venue page opens with the **"What did I order last time?"** card, then every visit and dish. |
| **Recommend** | Filters: Anywhere / Near me / neighborhood, minimum rating, price feel. Results come only from your log. One tap shares text like `Via Carota, West Village. Get: cacio e pepe, the Tuscan kale. Loved it.` through the system share sheet (clipboard fallback). |
| **Today** | "One year ago", "you loved this near here", and "dishes to order again". |

## Architecture

```
src/
  core/      Pure TypeScript, no DOM. Unit-tested.
    cluster.ts          photo -> meal clustering
    venueMatcher.ts     venue proposal + fallback chain (VenueSource interface)
    recommendFilter.ts  per-venue summaries and filters
    resurface.ts        one-year-ago / loved-nearby / order-again
    shareFormatter.ts   share text
    neighborhoods.ts    ~40 NYC neighborhood centroids
    types.ts            data model
  data/
    repo.ts             Repository interface: the only persistence contract
    idbRepo.ts          IndexedDB implementation (idb)
    confirmMeal.ts      triage card -> Venue + Meal + Dishes
    seed.ts             demo data
  import/    EXIF reading, thumbnails, CLIP food classifier (Web Worker),
             Overpass venue source, the import pipeline, import controller
  ui/        Tabs, triage, journal/venue pages, shared components, hash router
```

### Data model

`Venue`, `Meal`, `Dish` as specified, with string UUID ids and plain JSON values. Additions:
`Meal.priceFeel` (needed for the price filter), `isDemo` flags, and persisted
`MealCandidate` records for the triage queue.

### Clustering (`core/cluster.ts`)

Photos are sorted by time. Each photo joins the **nearest open cluster**: one whose newest photo
is within 3 hours, whose running centroid is within 100 m, and whose total span stays within
6 hours. Otherwise it starts a new cluster. Comparing against every open cluster (not just the
latest) keeps interleaved places apart, e.g. restaurant, then the bar next door, then back at
the table. Boundaries are inclusive. All thresholds live in `DEFAULT_CLUSTER_CONFIG`.

### Venue matching (`core/venueMatcher.ts`)

Ranks OpenStreetMap results by distance (venues you have visited get a small boost) and offers
the top three. **Fallback chain** when the lookup returns nothing, fails, times out or is turned
off: (1) venues already in your log within 150 m, then (2) a single "Unknown place" card that
asks you to type the name.

### Swapping in Supabase later

UI and pipeline code only talk to the `Repository` interface (`src/data/repo.ts`). To move to
Supabase, implement a `supabaseRepo.ts` against the same interface and pass it to
`RepoProvider` in `App.tsx`. Records are JSON-friendly with UUID ids, so they map onto tables.
Photo thumbnails (`savePhoto`/`getPhoto`) would move to Storage. Nothing in this repo
depends on Supabase today.

## Privacy and network use

- Everything is processed in your browser. There are no accounts and no analytics.
- Original photos are **never stored**. Only a small JPEG thumbnail (480 px) of each kept food
  photo is saved, in IndexedDB on your device.
- Network calls, all disclosed in the app before the first import:
  1. **One-time model download** from the Hugging Face CDN (a CLIP model, roughly 50-90 MB),
     then cached by the browser. Classification runs locally.
  2. **Venue lookup**: each meal's location, rounded to 4 decimals (about 11 m), is sent to the
     public OpenStreetMap Overpass API (`overpass-api.de`, with `overpass.kumi.systems` as a
     backup). No photos or other data are sent. Turn this off in Settings and venue names
     are typed by hand.
- Geolocation (for "Near me") is requested only when you tap it and is kept in memory only.

## Tests

```bash
npm test
```

Covers: clustering time and distance thresholds (including exact boundaries, interleaving and the
span cap); venue-matching fallback when lookup returns nothing, throws, times out or is switched
off; the Overpass parser and client; the import pipeline with injected fakes; triage
confirmation; recommend filters; resurfacing; the share formatter; demo data integrity.

## Known limitations

- **No camera-roll API on the web.** You pick photos or a folder; Plate can't scan in the
  background. iOS Safari may strip GPS from picked photos, so choose Options → Location:
  Include, or import from a desktop folder. HEIC files only decode in Safari.
- **Thumbnails are stored** (not original photos), because a browser can't reference your files
  later. Clear them with Settings → Erase all data.
- **Food detection is approximate.** It uses zero-shot CLIP with a score threshold
  (`IMPORT_CONFIG` in `src/import/importConfig.ts`) that needs tuning on real photos. The triage
  step lets you dismiss mistakes.
- **OpenStreetMap coverage varies**; dense blocks or new restaurants may show the wrong venue or
  none. Use "Somewhere else…" to type it.
- **Haptics** use the Vibration API: Android only. iOS Safari has none, so swipes snap visually.
- **Voice dictation** relies on your keyboard's microphone button, not the Web Speech API
  (Chrome's sends audio to a server).
- Each import run is clustered on its own, so a meal split across two separate imports becomes
  two cards.
- The real import path (EXIF GPS from an actual phone photo, the CLIP model, live Overpass
  results) has been exercised only through unit tests with injected fakes, not end to end on a
  real photo library.
- The service worker is a minimal app-shell cache; it is registered only in production builds.
- Neighborhood names come from Overpass tags or a bundled table of NYC centroids, so labels near
  borders can be off.
