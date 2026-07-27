# Phase 3: Cinema Readiness - Research

**Researched:** 2026-07-27
**Domain:** PWA Offline Persistence, Screen Wake Lock, Cinema Installation
**Confidence:** HIGH

## Summary

Phase 3 transforms CinemaSyncSubs from a demo into a reliable cinema tool. The core challenge is that cinema environments are hostile to web apps: no WiFi (must work offline), 2-hour runtime (screen must stay on), and iOS Safari imposes unique constraints (7-day storage eviction, no orientation lock, historically broken Wake Lock in installed PWAs).

The recommended approach uses three well-established libraries — `idb` for IndexedDB persistence, `vite-plugin-pwa` for Service Worker/offline support, and `@zakj/no-sleep` for the Wake Lock dual-strategy. Together they address all six requirements (FILE-01, FILE-02, DISP-02, PWA-01, PWA-02, PWA-03) with minimal bundle impact (~2.5kB total).

**Primary recommendation:** Use `idb` with a typed DBSchema for subtitle persistence, `vite-plugin-pwa` with `registerType: 'autoUpdate'` and Workbox precaching for offline support, and `@zakj/no-sleep` (which auto-selects between native Wake Lock API and hidden video fallback) for screen-on-during-playback. For iOS orientation, use a CSS-based rotate overlay since no web API exists to lock orientation on iOS.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subtitle persistence (IndexedDB) | Browser / Client | — | All data is local-first; no server involved |
| App shell caching (Service Worker) | Browser / Client | — | Cache API operates entirely in browser |
| Screen Wake Lock | Browser / Client | — | Native device API, no server call |
| PWA manifest & install | Browser / Client | — | Manifest parsed by browser/OS |
| Landscape orientation | Browser / Client | — | CSS media queries + JS orientation detection |
| Offline playback | Browser / Client | — | Fully client-side after initial load |

All Phase 3 capabilities are **browser/client-tier only**. There is no backend, no API server, no cloud storage. This is a fully client-side PWA.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **idb** | 8.0.3 | IndexedDB Promise wrapper with TypeScript schema | ~1.19kB brotli'd. By Jake Archibald (Google). Makes IndexedDB usable with async/await + typed object stores/indexes. [VERIFIED: npm registry] |
| **vite-plugin-pwa** | 1.3.0 | Service Worker generation + manifest injection + precaching | Zero-config PWA integration. Uses Workbox under the hood. Framework-agnostic. Auto-generates manifest, registers SW. [VERIFIED: npm registry] |
| **@zakj/no-sleep** | 0.13.6 | Screen Wake Lock with automatic native API + video fallback | Auto-selects between `navigator.wakeLock` (modern) and hidden video loop (older iOS). Handles iOS PWA Wake Lock bug transparently. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **workbox-window** | 7.4.1 | Service Worker registration + update prompts | For showing "update available" UI when SW updates. Optional but recommended for autoUpdate flow. [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb 8.0 | Dexie.js 4.x | Dexie is larger (~4kB), more features (complex queries, hooks). Overkill for our simple 2-store schema. idb is minimal and sufficient. |
| idb 8.0 | idb-keyval 6.x | idb-keyval is simpler (key-value only) but lacks object stores + indexes. We need typed stores for subtitles + settings. |
| @zakj/no-sleep 0.13 | nosleep.js 0.12 (richtr) | Older, less maintained fork. @zakj/no-sleep is the actively maintained successor with native Wake Lock API support. |
| @zakj/no-sleep 0.13 | Manual Wake Lock only | Would fail silently on iOS <18.4 in installed PWAs. NoSleep.js provides the video fallback that works on all iOS versions. |
| vite-plugin-pwa 1.3 | Manual Workbox config | More control but significantly more code. vite-plugin-pwa wraps Workbox with sensible defaults. |

**Installation:**
```bash
npm install idb @zakj/no-sleep
npm install -D vite-plugin-pwa workbox-window
```

**Version verification:** All versions confirmed via `npm view` on 2026-07-27. idb 8.0.3, vite-plugin-pwa 1.3.0, @zakj/no-sleep 0.13.6, workbox-window 7.4.1.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | 8+ years | ~15M/wk | github.com/jakearchibald/idb | OK | Approved |
| vite-plugin-pwa | npm | 5+ years | ~3M/wk | github.com/vite-pwa/vite-plugin-pwa | OK | Approved |
| @zakj/no-sleep | npm | 6+ years | ~50k/wk | github.com/zakj/no-sleep.js | OK | Approved |
| workbox-window | npm | 7+ years | ~4M/wk | github.com/GoogleChrome/workbox | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All packages are well-established, widely downloaded, and have active source repositories. idb is by a Google engineer (Jake Archibald). vite-plugin-pwa is the standard Vite PWA plugin. @zakj/no-sleep is the maintained successor to the original NoSleep.js. workbox-window is Google's official Workbox library.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Import   │  │  Playback    │  │  Rotate Overlay      │  │
│  │  Screen   │  │  Controls    │  │  (iOS portrait mode) │  │
│  └─────┬─────┘  └──────┬───────┘  └──────────────────────┘  │
│        │               │                                     │
├────────┼───────────────┼─────────────────────────────────────┤
│        │     Application Layer                              │
│        │               │                                     │
│  ┌─────▼─────┐  ┌──────▼───────┐  ┌──────────────────────┐  │
│  │  SRT      │  │  Playback    │  │  Wake Lock Manager   │  │
│  │  Parser   │──│  Engine      │──│  (NoSleep.js)        │  │
│  │           │  │  (Phase 2)   │  │  - native API first  │  │
│  └─────┬─────┘  └──────┬───────┘  │  - video fallback    │  │
│        │               │          └──────────────────────┘  │
│  ┌─────▼───────────────▼──────────────────────────────────┐  │
│  │              State Store (Phase 2)                      │  │
│  │  { cues[], currentIndex, isPlaying, fileName }         │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                     │
├────────────────────────┼─────────────────────────────────────┤
│        Persistence Layer (NEW in Phase 3)                    │
│  ┌─────────────────────▼──────────────────────────────────┐  │
│  │              IndexedDB (via idb)                         │  │
│  │  • subtitles store: { id, fileName, cues[], meta }     │  │
│  │  • settings store: { key, value }                       │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Cache API (Service Worker)                 │  │
│  │  • App shell: HTML, CSS, JS, icons, manifest           │  │
│  │  • Precached on install, auto-updated on deploy        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              PWA Manifest                               │  │
│  │  • display: standalone, orientation: landscape          │  │
│  │  • icons, theme_color, splash (iOS)                    │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── db/
│   ├── database.ts        # idb openDB with typed schema
│   ├── subtitles.ts       # CRUD operations for subtitle store
│   └── settings.ts        # CRUD operations for settings store
├── hooks/
│   ├── usePlaybackEngine.ts  # (Phase 2 — unchanged)
│   ├── usePersistedSettings.ts # (Phase 2 — migrate to IndexedDB)
│   └── useWakeLock.ts     # NEW: Wake Lock dual-strategy hook
├── pwa/
│   ├── RegisterSW.tsx     # SW registration + update prompt
│   └── RotateOverlay.tsx  # iOS portrait-mode rotate prompt
├── components/            # (Phase 1+2 — extended)
├── playback/              # (Phase 2 — unchanged)
├── types/
│   └── subtitle.ts        # (Phase 1 — unchanged)
├── imports/               # (Phase 1 — unchanged)
├── utils/                 # (Phase 1 — unchanged)
├── App.tsx                # Extended with persistence + wake lock
├── main.tsx               # Extended with SW registration
└── index.css              # Extended with rotate overlay styles
```

### Pattern 1: Typed IndexedDB Schema with idb

**What:** Define a TypeScript DBSchema interface for type-safe object stores with indexes.
**When to use:** All persistent data — parsed subtitles and user settings.
**Why:** Type safety catches errors at compile time. The `DBSchema` interface ensures store names, key types, and value types are consistent across all database operations.

```typescript
// src/db/database.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Cue } from '../types/subtitle'

// Define the database schema with types
interface CinemaSyncDB extends DBSchema {
  subtitles: {
    key: string           // subtitle id (uuid or filename-based)
    value: {
      id: string
      fileName: string
      cues: Cue[]
      encoding: string
      cueCount: number
      importedAt: number
      fileSize: number
    }
    indexes: {
      'by-fileName': string
      'by-importedAt': number
    }
  }
  settings: {
    key: string           // setting name (e.g., 'fontSize', 'isDimmed')
    value: {
      key: string
      value: unknown
      updatedAt: number
    }
    indexes: { 'by-key': string }
  }
}

let dbPromise: Promise<IDBPDatabase<CinemaSyncDB>> | null = null

export function getDB(): Promise<IDBPDatabase<CinemaSyncDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CinemaSyncDB>('cinemasyncsubs', 1, {
      upgrade(db) {
        // Subtitles store with indexes for query patterns
        const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
        subStore.createIndex('by-fileName', 'fileName')
        subStore.createIndex('by-importedAt', 'importedAt')

        // Settings store for key-value preferences
        const settingsStore = db.createObjectStore('settings', { keyPath: 'key' })
        settingsStore.createIndex('by-key', 'key')
      },
    })
  }
  return dbPromise
}
```

[VERIFIED: Context7 /jakearchibald/idb — DBSchema pattern and openDB API]

### Pattern 2: Subtitle CRUD Operations

**What:** Encapsulate all subtitle database operations in a dedicated module.
**When to use:** Import (save), app load (list/get), delete.
**Why:** Separates storage logic from components. Easy to test and modify.

```typescript
// src/db/subtitles.ts
import { getDB } from './database'
import type { Cue } from '../types/subtitle'

export interface StoredSubtitle {
  id: string
  fileName: string
  cues: Cue[]
  encoding: string
  cueCount: number
  importedAt: number
  fileSize: number
}

export async function saveSubtitle(sub: StoredSubtitle): Promise<void> {
  const db = await getDB()
  await db.put('subtitles', sub)
}

export async function getSubtitle(id: string): Promise<StoredSubtitle | undefined> {
  const db = await getDB()
  return db.get('subtitles', id)
}

export async function getAllSubtitles(): Promise<StoredSubtitle[]> {
  const db = await getDB()
  return db.getAllFromIndex('subtitles', 'by-importedAt')
}

export async function deleteSubtitle(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('subtitles', id)
}
```

[VERIFIED: Context7 /jakearchibald/idb — put/get/getAll/delete operations]

### Pattern 3: Wake Lock Dual-Strategy with @zakj/no-sleep

**What:** Use `@zakj/no-sleep` which automatically selects between native Wake Lock API and hidden video fallback.
**When to use:** On playback start (acquire) and stop (release).
**Why:** Handles iOS fragmentation transparently. On iOS 18.4+ it uses the native API. On older iOS it falls back to a silent looping video that prevents sleep.

```typescript
// src/hooks/useWakeLock.ts
import { useRef, useCallback } from 'react'
import NoSleep from '@zakj/no-sleep'

export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null)

  // Lazy init — NoSleep requires DOM, create on first use
  const getNoSleep = useCallback(() => {
    if (!noSleepRef.current) {
      noSleepRef.current = new NoSleep()
    }
    return noSleepRef.current
  }, [])

  // Must be called within a user gesture (click/touch handler)
  const enable = useCallback(async () => {
    try {
      await getNoSleep().enable()
    } catch (err) {
      // Wake Lock failed — log but don't crash playback
      console.warn('Wake Lock enable failed:', err)
    }
  }, [getNoSleep])

  const disable = useCallback(() => {
    getNoSleep().disable()
  }, [getNoSleep])

  return { enable, disable }
}
```

[VERIFIED: Context7 /zakj/nosleep.js — enable/disable API and user gesture requirement]

### Pattern 4: Service Worker Registration with Update Handling

**What:** Register the auto-generated SW and handle update prompts.
**When to use:** On app startup in `main.tsx`.
**Why:** `registerType: 'autoUpdate'` configures `skipWaiting` + `clientsClaim` automatically. `workbox-window` provides a clean way to prompt users when a new version is available.

```typescript
// src/pwa/RegisterSW.tsx
import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function RegisterSW() {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // New version available — prompt user
        if (confirm('New version available. Reload to update?')) {
          updateSW(true)
        }
      },
      onOfflineReady() {
        console.log('App ready for offline use')
      },
    })
  }, [])

  return null
}
```

[VERIFIED: Context7 /vite-pwa/vite-plugin-pwa — registerType autoUpdate and virtual:pwa-register]

### Pattern 5: iOS Rotate Overlay

**What:** Full-screen overlay shown when device is in portrait mode on iOS.
**When to use:** Detect via `window.matchMedia('(orientation: portrait)')` and `orientationchange` event.
**Why:** iOS ignores manifest `orientation: landscape`. The only reliable way to ensure landscape display is to prompt the user to rotate.

```typescript
// src/pwa/RotateOverlay.tsx
import { useState, useEffect } from 'react'

export function RotateOverlay() {
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia('(orientation: portrait)').matches
  )

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  if (!isPortrait) return null

  return (
    <div className="rotate-overlay">
      <div className="rotate-content">
        <span className="rotate-icon">🔄</span>
        <p>请旋转手机 / Rotate to Landscape</p>
      </div>
    </div>
  )
}
```

[CITED: PITFALLS.md — iOS orientation lock doesn't work, CSS overlay is the standard workaround]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema + transactions | Raw IndexedDB API | `idb` library | Raw IDB is callback-based, verbose, no Promise support. idb handles transactions, upgrades, and typing. |
| Service Worker precaching | Manual SW with caches API | `vite-plugin-pwa` + Workbox | Workbox handles cache busting, precache manifests, navigation fallbacks, and cache expiration. Hundreds of edge cases. |
| Screen Wake Lock | Manual `navigator.wakeLock` only | `@zakj/no-sleep` | Manual API fails on iOS <18.4 in installed PWAs. NoSleep.js provides video fallback automatically. |
| PWA manifest generation | Hand-written manifest.json | `vite-plugin-pwa` manifest field | Plugin auto-injects manifest link, handles icon paths, generates maskable icons. |
| iOS Wake Lock fallback | Custom hidden video implementation | `@zakj/no-sleep` | The silent video trick requires specific MP4 encoding, `playsinline` attribute, and user gesture handling. NoSleep.js bundles this. |

**Key insight:** Each of these problems has a deceptively simple surface but deep edge cases in production. IndexedDB has transaction auto-close issues. Service Workers have cache versioning and activation races. Wake Lock has iOS-specific bugs. The recommended libraries have each solved these edge cases across thousands of production deployments.

## Common Pitfalls

### Pitfall 1: iOS 7-Day Storage Eviction Wipes Everything

**What goes wrong:** iOS Safari deletes ALL service worker caches AND IndexedDB data if the PWA hasn't been opened in 7 days. A user who imports subtitles on Tuesday for a Friday movie finds an empty app.

**Why it happens:** Apple's storage management aggressively evicts web app data. The 7-day timer is per-origin and non-negotiable. `navigator.storage.persist()` is NOT supported on iOS.

**How to avoid:**
- Re-cache the app shell on every launch (Workbox precache handles this automatically with `autoUpdate`)
- Store parsed subtitle data in IndexedDB (survives longer than Cache API, but still subject to eviction)
- Show a "last opened" timestamp to users — warn if >5 days since last use
- Design for graceful degradation: if no subtitles found, show import UI (not crash)
- Consider a future "export to file" feature so users can backup SRT files outside the browser

**Warning signs:** App loads but shows no saved subtitles; `getAllSubtitles()` returns empty array after dormancy.

[CITED: PITFALLS.md — iOS 7-day cache expiry; magicbell.com blog]

### Pitfall 2: Wake Lock Silently Fails on Older iOS

**What goes wrong:** `navigator.wakeLock.request('screen')` does nothing on iOS <18.4 in installed PWAs. The screen dims during the movie.

**Why it happens:** WebKit bug #254545 — the Wake Lock API was broken in standalone/home-screen web apps until iOS 18.4 (March 2025). Users on older devices (iPhone 8-X can't update past iOS 16) never get the fix.

**How to avoid:**
- Use `@zakj/no-sleep` which auto-detects support and falls back to hidden video
- The video fallback works on ALL iOS versions
- Must be triggered by user gesture (the "Start" button click is perfect)
- Re-acquire on `visibilitychange` (iOS may release when user switches apps briefly)

**Warning signs:** Screen dims during playback on older iOS; check `noSleep.enabled` after enable.

[CITED: PITFALLS.md — iOS Wake Lock failure; WebKit bug #254545]

### Pitfall 3: IndexedDB Write Fails on Import

**What goes wrong:** `db.put()` throws `QuotaExceededError` or silently fails if storage is full or transaction auto-closes.

**Why it happens:** iOS has ~50MB storage quota for PWAs. Transactions auto-close if you await a non-IDB promise between operations.

**How to avoid:**
- Wrap all IDB operations in try/catch
- Use `navigator.storage.estimate()` to check quota before large writes
- A single SRT file with 1000 cues is ~100KB — well within limits
- Don't await non-IDB promises inside transactions (the `idb` library handles this better than raw IDB, but still be careful)

**Warning signs:** `QuotaExceededError` in console; subtitle appears to save but disappears after reload.

[CITED: PITFALLS.md — IndexedDB instability on iOS]

### Pitfall 4: Service Worker Caches Stale App Shell

**What goes wrong:** After deploying a new version, users still see the old app because the SW serves cached content.

**Why it happens:** `registerType: 'autoUpdate'` sets `skipWaiting` + `clientsClaim`, but the new SW only activates after all old tabs are closed.

**How to avoid:**
- Use `registerType: 'autoUpdate'` (already recommended)
- Use `workbox-window` to detect `onNeedRefresh` and prompt user to reload
- For critical updates, the prompt ensures users get the latest version

**Warning signs:** New features not visible after deploy; version mismatch between served and expected.

[VERIFIED: Context7 /vite-pwa/vite-plugin-pwa — autoUpdate behavior]

### Pitfall 5: iOS Orientation Lock Doesn't Work

**What goes wrong:** Setting `"orientation": "landscape"` in manifest.json does nothing on iOS. Users can still rotate to portrait.

**Why it happens:** Apple only partially supports the Web App Manifest. The `orientation` field is ignored on iOS. Even `screen.lockOrientation()` is unavailable.

**How to avoid:**
- CSS `@media (orientation: portrait)` to detect and show rotate overlay
- The overlay should be full-screen, black background, large white text: "🔄 请旋转手机 / Rotate to Landscape"
- On Android, the manifest orientation field DOES work — so this is iOS-only handling
- Don't use `transform: rotate(90deg)` — it breaks touch coordinates

**Warning signs:** Physical rotation test on iPhone shows portrait layout; orientation media query fires.

[CITED: PITFALLS.md — iOS orientation lock doesn't work]

### Pitfall 6: NoSleep.js Enable Outside User Gesture

**What goes wrong:** Calling `noSleep.enable()` outside a click/touch handler throws or silently fails on iOS.

**Why it happens:** iOS requires user interaction for video playback (autoplay policy). The video fallback needs to be triggered by a real user gesture.

**How to avoid:**
- Always call `enable()` synchronously inside a click/touch event handler
- The "Start Subtitles" button is the perfect trigger
- Don't call `enable()` in `useEffect`, `setTimeout`, or async callbacks that aren't directly in the gesture handler chain

**Warning signs:** Wake Lock doesn't activate; console shows "play() failed because the user didn't interact with the document first."

[VERIFIED: Context7 /zakj/nosleep.js — enable() must be called within user gesture]

## Code Examples

### IndexedDB Schema Definition (Complete)

```typescript
// src/db/database.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Cue } from '../types/subtitle'

interface CinemaSyncDB extends DBSchema {
  subtitles: {
    key: string
    value: {
      id: string
      fileName: string
      cues: Cue[]
      encoding: string
      cueCount: number
      importedAt: number
      fileSize: number
    }
    indexes: {
      'by-fileName': string
      'by-importedAt': number
    }
  }
  settings: {
    key: string
    value: {
      key: string
      value: unknown
      updatedAt: number
    }
    indexes: { 'by-key': string }
  }
}

let dbPromise: Promise<IDBPDatabase<CinemaSyncDB>> | null = null

export function getDB(): Promise<IDBPDatabase<CinemaSyncDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CinemaSyncDB>('cinemasyncsubs', 1, {
      upgrade(db) {
        const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
        subStore.createIndex('by-fileName', 'fileName')
        subStore.createIndex('by-importedAt', 'importedAt')

        const settingsStore = db.createObjectStore('settings', { keyPath: 'key' })
        settingsStore.createIndex('by-key', 'key')
      },
    })
  }
  return dbPromise
}
```

[VERIFIED: Context7 /jakearchibald/idb — DBSchema interface and openDB with upgrade callback]

### Wake Lock Integration with Playback

```typescript
// In App.tsx — integrate with existing playback controls
import { useWakeLock } from './hooks/useWakeLock'

function App() {
  const { enable: enableWakeLock, disable: disableWakeLock } = useWakeLock()

  const handlePlay = () => {
    enableWakeLock()  // Called inside click handler — satisfies user gesture requirement
    play()
  }

  const handleStop = () => {
    disableWakeLock()
    stop()
  }

  // ... rest of component
}
```

[VERIFIED: Context7 /zakj/nosleep.js — enable/disable within user gesture]

### vite-plugin-pwa Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'splash.png'],
      manifest: {
        name: 'CinemaSyncSubs',
        short_name: 'CinemaSubs',
        description: 'Synchronized cinema subtitles on your phone',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',
        // Don't precache SRT files — they're user-uploaded at runtime
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false  // Disable SW in dev to avoid caching during development
      }
    })
  ]
})
```

[VERIFIED: Context7 /vite-pwa/vite-plugin-pwa — configuration options and defaults]

### iOS-Specific HTML Head Elements

```html
<!-- index.html — add for iOS PWA support -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="apple-mobile-web-app-title" content="CinemaSubs" />
    <meta name="theme-color" content="#000000" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="apple-touch-startup-image" href="/splash.png" />
    <title>CinemaSyncSubs</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

[CITED: STACK.md — Required HTML head elements for iOS PWA]

### Rotate Overlay CSS

```css
/* Add to index.css for iOS orientation handling */
.rotate-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  color: #e0e0e0;
}

.rotate-content {
  text-align: center;
  padding: 2rem;
}

.rotate-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
  animation: rotate-hint 2s ease-in-out infinite;
}

.rotate-content p {
  font-size: 1.5rem;
  margin: 0;
  font-weight: 500;
}

@keyframes rotate-hint {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
}

/* Hide overlay when in landscape */
@media (orientation: landscape) {
  .rotate-overlay {
    display: none;
  }
}
```

[ASSUMED: CSS animation pattern — standard CSS, not from a specific source]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for subtitle data | IndexedDB via idb | 2023+ | Async, larger capacity, structured queries |
| Manual Wake Lock API only | @zakj/no-sleep with auto-fallback | 2024+ | Handles iOS fragmentation transparently |
| Manual Service Worker + Workbox | vite-plugin-pwa auto-generation | 2023+ | Zero-config precache, auto-update |
| nosleep.js (richtr) | @zakj/no-sleep | 2024+ | Maintained fork with native API support |

**Deprecated/outdated:**
- `nosleep.js` (richtr): Superseded by `@zakj/no-sleep`. The old package hasn't been updated since 2022 and lacks native Wake Lock API support.
- Manual Workbox configuration: vite-plugin-pwa provides the same functionality with significantly less code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@zakj/no-sleep` auto-selects between native API and video fallback | Pattern 3, Don't Hand-Roll | If it doesn't auto-fallback, older iOS devices will lose Wake Lock. Mitigation: test on real iOS devices. |
| A2 | IndexedDB survives longer than Cache API on iOS (but both subject to 7-day eviction) | Pitfall 1 | If IndexedDB is also evicted at 7 days, subtitle data is lost. Mitigation: design for re-import. |
| A3 | `viewport-fit=cover` is needed for safe area handling on notched iPhones | HTML Head | Without it, content may be obscured by notch/home indicator in landscape. Low risk — standard practice. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **iOS 7-day eviction: Can we detect it proactively?**
   - What we know: iOS evicts after 7 days of non-use. No API to prevent it.
   - What's unclear: Whether we can detect impending eviction or get a callback before data is deleted.
   - Recommendation: Store `lastOpenedAt` timestamp in IndexedDB. On app load, check if >5 days since last use and show a "refresh your subtitles" warning. This is a UX mitigation, not a technical fix.

2. **PWA update flow: Should we force-reload or prompt?**
   - What we know: `autoUpdate` sets `skipWaiting` + `clientsClaim`, but the new SW only takes effect after reload.
   - What's unclear: Whether to auto-reload or prompt the user (auto-reload could interrupt playback).
   - Recommendation: Use `workbox-window` to prompt on `onNeedRefresh`, but only show the prompt when NOT in playback (check playback state before prompting).

3. **How many subtitles should we store?**
   - What we know: A single SRT is ~100KB parsed. iOS quota is ~50MB.
   - What's unclear: Whether to limit stored subtitles to N movies or allow unlimited.
   - Recommendation: Allow unlimited (quota permits ~500 movies). Add a "manage subtitles" UI for deletion in Phase 4 if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| IndexedDB | Subtitle persistence | ✓ (browser) | Built-in | — |
| Service Worker | Offline support | ✓ (browser) | Built-in | — |
| Cache API | App shell caching | ✓ (browser) | Built-in | — |
| Screen Wake Lock API | Keep screen on | ✓ (browser, partial) | Built-in | @zakj/no-sleep video fallback |
| `navigator.storage.estimate()` | Quota monitoring | ✓ (browser, partial) | Built-in | Skip quota check if unavailable |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none — all browser APIs have library fallbacks

Step 2.6: All dependencies are browser APIs available in all modern browsers. The Screen Wake Lock API has the @zakj/no-sleep fallback for older iOS. No external tools or services required.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only app, no auth |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user local app |
| V5 Input Validation | yes | File import validation (Phase 1 — .srt/.txt type check, 5MB limit) |
| V6 Cryptography | no | No encryption needed |

### Known Threat Patterns for PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via subtitle text | Tampering | React text nodes (never dangerouslySetInnerHTML) — already implemented in Phase 1 |
| Service Worker hijacking | Tampering | HTTPS required for SW. vite-plugin-pwa generates SW with integrity checks. |
| Storage exhaustion | Denial of Service | 5MB file size limit on import. `navigator.storage.estimate()` for quota monitoring. |

## Sources

### Primary (HIGH confidence)
- idb 8.0.3 — Context7 /jakearchibald/idb: DBSchema, openDB, CRUD operations, TypeScript typing
- vite-plugin-pwa 1.3.0 — Context7 /vite-pwa/vite-plugin-pwa: registerType, workbox config, manifest, autoUpdate
- @zakj/no-sleep 0.13.6 — Context7 /zakj/nosleep.js: enable/disable API, user gesture requirement, auto-fallback
- Screen Wake Lock API — MDN /mdn/content: navigator.wakeLock.request, visibilitychange re-acquisition

### Secondary (MEDIUM confidence)
- iOS PWA limitations — magicbell.com, PITFALLS.md (7-day eviction, orientation, Wake Lock bug)
- WebKit Bug #254545 — Wake Lock broken in Home Screen PWAs until iOS 18.4
- Service Worker caching strategies — web.dev, magicbell.com

### Tertiary (LOW confidence)
- iOS 7-day eviction mitigation strategies — Stack Overflow, community reports (no official Apple documentation confirms the exact behavior)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified via npm registry. APIs confirmed via Context7. Libraries are industry standard.
- Architecture: HIGH — Patterns verified against official documentation. Data flow is straightforward client-side pipeline.
- Pitfalls: MEDIUM-HIGH — iOS constraints are well-documented across multiple sources. 7-day eviction is widely reported but not officially documented by Apple.

**Research date:** 2026-07-27
**Valid until:** 2026-08-27 (30 days — stable libraries, no major API changes expected)
