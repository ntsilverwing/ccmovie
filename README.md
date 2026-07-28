# ccmovie — CinemaSyncSubs

A PWA tool that turns your phone into a synchronized subtitle display for non-native English speakers watching foreign films in North American theaters.

## The Problem

Closed caption devices in North American cinemas only provide English or French subtitles. If you're a non-English speaker watching a foreign film, you're out of luck — there's no way to follow the plot.

## How It Works

1. Download the SRT subtitle file for your movie
2. Import it into the app (file picker or drag-and-drop)
3. In the theater, tap "Start" when the movie begins
4. Your phone displays synchronized white-on-black subtitles — OLED-optimized to minimize disturbance to others

## Features

- **SRT Import & Parse** — Supports GBK, UTF-8, Big5, Shift-JIS encoding auto-detection
- **Precision Timing** — `performance.now()` + `requestAnimationFrame` architecture, <50ms drift over 2 hours
- **OLED-Optimized Display** — Pure black background (#000000) with dimmed white text (#E0E0E0)
- **Adjustable Font Size** — 36px to 72px slider with persistence
- **Timing Offset** — Fine-tune subtitle sync by ±N seconds in real-time
- **High Contrast Mode** — Yellow text (#FFD700) for better readability
- **Dim Mode** — Darker gray text for ultra-dark environments
- **Offline-First** — Service Worker precaches app shell; works without network after first load
- **Persistent Storage** — Subtitle files saved in IndexedDB across sessions
- **Screen Wake Lock** — Keeps screen on during entire playback (with NoSleep.js fallback for older iOS)
- **PWA Installable** — Add to home screen, landscape orientation support

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Vite 6 | Build tool + dev server |
| React 18 | UI framework |
| TypeScript | Type safety |
| vite-plugin-pwa | Service worker + manifest generation |
| idb | IndexedDB wrapper for subtitle storage |
| chardet | Character encoding detection |
| @zakj/no-sleep | Wake Lock fallback for older browsers |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

## Usage

1. Open the app in your mobile browser
2. Tap "Import" and select an `.srt` subtitle file
3. Review the parsed cues, then tap "Start" when the movie begins
4. Place your phone in landscape orientation (OLED screens recommended)

> **Tip:** Set your screen brightness to minimum before the movie for the best experience with minimal light disturbance to others.

## Project Status

v1.0 — All 4 development phases complete. Core functionality implemented and tested.

## License

MIT
