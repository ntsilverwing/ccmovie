# API Coverage — Phase 6

> No external API integration: the phase works exclusively against the browser-native IndexedDB Web API via the in-repo `idb` wrapper (`src/db/`) — no external service, SDK, endpoint, or network surface exists in scope. Deterministic detector run at planning returned `detected: false`; full-coverage matrix documents this negative case explicitly.

| capability | decision | reason |
|---|---|---|
| external REST/GraphQL endpoint | OPT-OUT | no external API in scope — phase uses browser-native IndexedDB only |
| third-party SDK | OPT-OUT | no third-party SDK — uses in-repo `idb` wrapper only |
| network service | OPT-OUT | no network surface — all persistence is local (IndexedDB) |
| cloud/remote sync | OPT-OUT | explicitly local-only per project scope (prohibition: no network path) |
