# Bundle baseline — 2026-08-31

Clean production build (`rm -rf .next && bun run build --filter=web`).

| | |
|---|---|
| **Commit** | `c82f70d3` |
| **BUILD_ID** | see `routes.txt` header |
| **Next.js** | 16.3.0 |
| **Build result** | exit 0, no errors |

## Client bundle

| Metric | Value |
|---|---|
| `.next/static` total | **3.3 MB** |
| JS files | **89** |
| JS bytes | **2,555.7 KB** |
| CSS files | 3 |
| CSS bytes | **332.8 KB** |
| `.next/server` | 79 MB |
| `.next/standalone` | 64 MB |

## Ten largest client chunks

| Size | Chunk |
|---|---|
| 314.5 KB | `0vic0d_u5a3p7.js` |
| 227.8 KB | `0htlom74lttaq.js` |
| 135.2 KB | `15llb1qsyuzv8.js` |
| 130.9 KB | `03f8q_drpd1vc.js` |
| 125.1 KB | `3zhqhmutauai2.js` |
| 110.0 KB | `0cz1d0mv5g_q7.js` |
| 96.4 KB | `2dl50-fsqhxwj.js` |
| 74.0 KB | `3w4etg43es6n5.js` |
| 69.1 KB | `2td4iqcqo2lr-.js` |
| 65.8 KB | `2nf-1cyhrnp4t.js` |

Chunk hashes change every build; sizes are the comparable figure.

## Route classification — from the build, not the manifest

| Class | Count |
|---|---|
| `ƒ` Dynamic — server-rendered on demand | **65** |
| `◐` Partial-prerender shell (dynamic segments) | 11 |
| `○` Static | **2** (`/robots.txt`, `/sitemap.xml`) |

**Only two routes in the entire app are static.** Full table in `build-output.txt`.

Next 16 no longer prints a per-route "First Load JS" column, so per-route JS is
taken from runtime measurement instead (`vitals.json`) — and it is near-uniform
at ~357 KB, which is the more useful number anyway.
