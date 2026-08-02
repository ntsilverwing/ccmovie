# API Coverage — Phase 5

> No external API integration: Phase 5 works exclusively against the browser-native History API (popstate), Fullscreen API, and Wake Lock API — all browserBuilt-in surfaces, not external services. Deterministic detector reported a false positive (likely tripped on "API" tokens in source comments about the browser Fullscreen/Wake Lock APIs). Full-coverage matrix documents this negative case explicitly per gate contract.

| capability | decision | reason |
|---|---|---|
| external REST/GraphQL endpoint | OPT-OUT | no external API in scope — phase uses browser-native History/Fullscreen/Wake Lock APIs only |
| third-party SDK | OPT-OUT | no third-party SDK — browser built-ins only |
| network service | OPT-OUT | no network surface — all state managed client-side via React state + IndexedDB |
| cloud/remote sync | OPT-OUT | explicitly local-only per project scope |
