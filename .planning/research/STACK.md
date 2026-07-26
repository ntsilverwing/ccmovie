# Technology Stack

**Project:** CinemaSyncSubs (ccmovie)
**Researched:** 2026-07-25
**Mode:** Ecosystem — Stack dimension

---

## Recommended Stack

### Core Build & PWA Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vite** | 8.1.5 | Build tool + dev server | Fastest HMR, smallest config, purpose-built for SPA/PWA. No SSR overhead like Next.js. |
| **vite-plugin-pwa** | 1.3.0 | Service worker + manifest generation | Zero-config PWA integration. Uses Workbox under the hood. Auto-generates manifest, registers SW, handles precaching. Framework-agnostic. |
| **Workbox** | 7.4.1 | Service worker runtime (via vite-plugin-pwa) | Google's battle-tested SW library. Precaches app shell, runtime-caches SRT files. Transitive dep of vite-plugin-pwa. |

**Why Vite over alternatives:**
- **Next.js**: SSR/SSG overhead unnecessary for a client-only PWA. Adds complexity (file routing, server components) with zero benefit for this use case.
- **SvelteKit**: Viable but smaller ecosystem. Framework lock-in for a simple app.
- **Angular**: Massive bundle size, steep learning curve. Overkill.
- **Vanilla Vite (no framework)**: Possible but React/Vue component model helps manage subtitle rendering state. Recommend **React 18+** or **Vue 3** — pick whichever the AI coding assistant handles best.

### Subtitle Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **subtitle.js** | 4.2.2 | SRT/VTT parsing | Stream-based + sync parsing. `parseSync()` returns array of `{type:'cue', data:{start, end, text}}` with millisecond timestamps. TypeScript support, 100% code coverage, maintained since 2015. |

**Why subtitle.js over alternatives:**
- **subsrt**: More formats but heavier, less maintained.
- **SubtitlesParser (alexpoint)**: Supports more formats (TTML, etc.) but overkill for SRT-only v1.
- **Custom regex parser**: SRT has edge cases (multi-line, BOM, varying timestamp formats). Use a library.

### Offline Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **idb** | 8.0.3 | IndexedDB Promise wrapper | ~1.19kB brotli'd. Makes IndexedDB usable with async/await. By Jake Archibald (Google engineer). |
| **Cache API** | Built-in | App shell caching (JS/CSS/HTML) | Handled automatically by vite-plugin-pwa precache. |

**Storage strategy:**
- **Cache API** (via Workbox precache): App shell — HTML, JS bundle, CSS, icons. Updated automatically on new deployments.
- **IndexedDB** (via idb): Parsed subtitle cues + raw SRT text. Stored per-movie. Queried by timestamp during playback.

**Why IndexedDB over localStorage:**
- localStorage limited to ~5MB. A 2-hour movie SRT can be 200-500KB+ (fine for localStorage), but IndexedDB has no practical limit.
- IndexedDB is async (doesn't block UI thread during subtitle lookups).
- Structured data (subtitle cues) benefits from IndexedDB indexing if we later add search.

**idb vs idb-keyval:** Use `idb` (not idb-keyval) because we need object stores with potential indexing on `movieId` + `timestamp` for efficient playback queries.

### Screen Wake Lock

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Screen Wake Lock API** | Native browser API | Keep screen on during movie | Supported in Safari 16.4+ (iOS + macOS), Chrome 84+, Firefox 126+. No library needed. |

**Critical note:** There is **NO web API to control screen brightness**. The Wake Lock API only prevents dimming/locking. Users must manually set system brightness to minimum before the movie. The app should instruct this on first launch.

### UI Framework (Pick One)

| Option | When to Pick |
|--------|-------------|
| **React 18+** | If AI assistant has strongest React support. Largest ecosystem. |
| **Vue 3** | If preferring simpler template syntax. Smaller learning curve. |

**Recommendation:** Use whichever framework the AI coding tool generates most reliably. For a simple single-page app with one main view (subtitle display), the framework choice is not critical. Avoid adding a framework at all if vanilla TS suffices — the app is essentially: file picker → parse → timer-based text display.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 8 | Next.js 15 | SSR unnecessary; adds routing/server complexity |
| Build tool | Vite 8 | Create React App | Deprecated (2025), no longer maintained |
| PWA plugin | vite-plugin-pwa 1.3 | @vue/pwa | Vue-only; vite-plugin-pwa is framework-agnostic |
| PWA plugin | vite-plugin-pwa 1.3 | Manual Workbox | vite-plugin-pwa wraps Workbox with zero config |
| Subtitle parser | subtitle.js 4.2 | subsrt | subsrt less maintained, larger bundle |
| Subtitle parser | subtitle.js 4.2 | Custom regex | SRT edge cases (BOM, multi-line, timestamp formats) |
| Storage | idb 8.0 | idb-keyval 6.3 | idb supports object stores + indexing; keyval is too simple |
| Storage | idb 8.0 | localStorage | 5MB limit, synchronous (blocks UI), no indexing |
| Storage | idb 8.0 | localForage | localForage is largely superseded by idb; larger bundle |

---

## iOS Safari Specifics

These constraints directly affect implementation:

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No `beforeinstallprompt` | Can't prompt install automatically | Add explicit "Add to Home Screen" instructions UI |
| Only `display: standalone` | No fullscreen; status bar always visible | Design for safe area insets; use `env(safe-area-inset-*)` |
| No brightness API | Can't control brightness programmatically | Show pre-movie instructions to set brightness to minimum |
| Storage eviction | iOS clears PWA storage after ~7 days of non-use | Re-download SRT if cache cleared; store in IndexedDB |
| EU iOS 17.4+ | PWAs open in browser tab, not standalone | Detect `navigator.standalone`; show degraded experience notice |
| `apple-touch-startup-image` required | No splash screen without it | Include splash image link in HTML head |
| `apple-mobile-web-app-capable` | Needed for startup images | Include meta tag even though manifest handles display mode |
| Wake Lock API | Supported since iOS 16.4 | Use `navigator.wakeLock.request('screen')` with re-acquisition on visibility change |

**Required HTML head elements for iOS:**
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="CinemaSubs">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="apple-touch-startup-image" href="/splash.png">
<meta name="theme-color" content="#000000">
```

---

## Installation

```bash
# Core
npm create vite@latest ccmovie -- --template react-ts
cd ccmovie

# PWA
npm install -D vite-plugin-pwa

# Subtitle parsing
npm install subtitle

# IndexedDB wrapper
npm install idb

# Workbox types (dev only, for SW type hints)
npm install -D workbox-build workbox-window
```

---

## vite-plugin-pwa Configuration

```typescript
// vite.config.ts
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
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Don't precache SRT files — they're user-uploaded at runtime
        navigateFallback: '/index.html'
      }
    })
  ]
})
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Vite + vite-plugin-pwa | **HIGH** | Verified versions via npm registry; Context7 docs confirm API; industry standard |
| subtitle.js | **HIGH** | Context7 verified API; version confirmed via npm registry; well-maintained |
| idb | **HIGH** | Official Google library; version confirmed; tiny bundle; standard choice |
| Screen Wake Lock API | **HIGH** | MDN + web.dev confirm universal browser support including Safari 16.4+ |
| iOS Safari constraints | **MEDIUM** | Multiple sources agree on limitations; EU situation (17.4+) is evolving |
| Brightness control | **HIGH** | Confirmed: NO web API exists. Wake Lock is the only screen control available. |

---

## Sources

- vite-plugin-pwa: Context7 `/vite-pwa/vite-plugin-pwa` (MEDIUM confidence)
- subtitle.js: Context7 `/gsantiago/subtitle.js` (MEDIUM confidence)
- Screen Wake Lock API: MDN + web.dev (LOW confidence via tavily, but HIGH via MDN direct)
- iOS PWA constraints: magicbell.com, firt.dev, brainhub.eu (LOW confidence via tavily)
- IndexedDB strategy: web.dev, Microsoft Edge docs (LOW confidence via tavily)
- idb library: github.com/jakearchibald/idb (LOW confidence via tavily, but HIGH as official Google lib)
- Versions: npm registry API (HIGH confidence)
