---
phase: 03-cinema-readiness
plan: 05
subsystem: i18n
tags: [i18n, react-context, translations, bilingual, language-toggle]

requires:
  - phase: 03-04
    provides: PWA foundation with RotateOverlay and RegisterSW components
provides:
  - Lightweight i18n system with en/zh translation dictionaries
  - LanguageProvider context wrapping the entire app
  - Language toggle button in import and ready views
  - Persistent language preference via usePersistedSettings
affects: [ui, playback, pwa]

tech-stack:
  added: []
  patterns: [React Context for i18n, dictionary-based translations, lang-aware non-component modules via loadSettings]

key-files:
  created:
    - src/i18n/translations.ts
    - src/i18n/LanguageContext.tsx
  modified:
    - src/hooks/usePersistedSettings.ts
    - src/main.tsx
    - src/App.tsx
    - src/components/PlaybackControls.tsx
    - src/components/CuePreview.tsx
    - src/components/FilePicker.tsx
    - src/imports/fileImport.ts
    - src/pwa/RotateOverlay.tsx
    - src/pwa/RegisterSW.tsx
    - src/index.css

key-decisions:
  - "Default language set to 'zh' — app's primary audience is Chinese-speaking cinema-goers"
  - "t() function signature: t(lang, key, params?) for direct use; useLanguage() hook wraps as t(key, params?) for components"
  - "Non-component modules (fileImport.ts, RegisterSW.tsx) read lang from loadSettings() instead of using hook"

patterns-established:
  - "i18n pattern: useLanguage() hook in React components, loadSettings().lang + t(lang, key) in non-component modules"
  - "Translation key structure: flat keys organized by source file comments"

requirements-completed: [DISP-02]

coverage:
  - id: D1
    description: "i18n infrastructure — translations dictionary and LanguageContext"
    requirement: DISP-02
    verification:
      - kind: unit
        ref: "src/i18n/translations.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "All hardcoded English strings replaced with t() calls across 7 files"
    requirement: DISP-02
    verification:
      - kind: unit
        ref: "src/App.tsx, src/components/PlaybackControls.tsx, src/components/CuePreview.tsx, src/components/FilePicker.tsx, src/imports/fileImport.ts, src/pwa/RotateOverlay.tsx, src/pwa/RegisterSW.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Language toggle button visible in import and ready views"
    requirement: DISP-02
    verification:
      - kind: unit
        ref: "src/App.tsx"
        status: pass
    human_judgment: true
    rationale: "Visual verification needed — toggle button positioning and 中文/EN label switching requires human eye"
  - id: D4
    description: "Language preference persists across page reloads"
    requirement: DISP-02
    verification:
      - kind: unit
        ref: "src/hooks/usePersistedSettings.ts"
        status: pass
    human_judgment: true
    rationale: "Persistence behavior requires manual reload test to confirm localStorage round-trip"

duration: 6min
completed: 2026-07-29
status: complete
---

# Phase 03 Plan 05: i18n & Language Toggle Summary

**Bilingual UI (en/zh) with React Context, 30+ translated strings, persistent language preference, and toggle button**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-29T05:25:25Z
- **Completed:** 2026-07-29T05:32:16Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created typed translation dictionary with 24 keys in English and Chinese
- Built LanguageProvider context with useLanguage hook for component-level access
- Replaced all hardcoded English strings across 7 UI components and 1 utility module
- Added language toggle button (中文/EN) in import and ready views
- Language preference persists via localStorage through usePersistedSettings
- Default language set to Chinese for primary audience

## Task Commits

Each task was committed atomically:

1. **Task 1: Create i18n infrastructure** - `2620cb0` (feat)
2. **Task 2: Replace hardcoded strings and add toggle** - `56d5028` (feat)

## Files Created/Modified
- `src/i18n/translations.ts` - en/zh translation dictionary with t() function
- `src/i18n/LanguageContext.tsx` - LanguageProvider and useLanguage hook
- `src/hooks/usePersistedSettings.ts` - Added lang field, exported loadSettings
- `src/main.tsx` - Wraps App with LanguageProvider
- `src/App.tsx` - t() for all strings, language toggle button
- `src/components/PlaybackControls.tsx` - t() for all button labels
- `src/components/CuePreview.tsx` - t() for metadata labels and empty state
- `src/components/FilePicker.tsx` - t() for drop zone text
- `src/imports/fileImport.ts` - t(lang, ...) for error messages
- `src/pwa/RotateOverlay.tsx` - t() for rotate prompt
- `src/pwa/RegisterSW.tsx` - t(lang, ...) for update/offline messages
- `src/index.css` - Language toggle button styles

## Decisions Made
- Default language set to 'zh' — app's primary audience is Chinese-speaking cinema-goers
- t() function signature: t(lang, key, params?) for direct use in non-component modules; useLanguage() hook wraps it as t(key, params?) for React components
- Non-component modules (fileImport.ts, RegisterSW.tsx) read lang from loadSettings() instead of using the hook

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- i18n system complete and ready for any future UI text additions
- All components now use t() pattern — new components should follow same approach
- Phase 03 (cinema-readiness) nearing completion

---
*Phase: 03-cinema-readiness*
*Completed: 2026-07-29*
