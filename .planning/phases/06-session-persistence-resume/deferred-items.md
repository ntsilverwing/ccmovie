# Phase 06 — Deferred Items

| Item | Found during | Description | Reason deferred |
|------|--------------|-------------|-----------------|
| brace-expansion npm advisory | 06-01 Task 2 (Wave-0 install) | `npm audit` flags 1 high-severity advisory in `brace-expansion@2.1.2`, transitively via `vite-plugin-pwa@1.3.0 → workbox-build@7.4.1 → ejs/jake` (GHSA-mh99-v99m-4gvg, DoS via unbounded expansion) | Pre-existing — NOT introduced by fake-indexeddb (zero runtime deps, verified `npm view`). Dev/build-time only, never shipped in the client bundle. Upstream fix requires workbox-build/vite-plugin-pwa bump, out of scope for the persistence-core plan. |
