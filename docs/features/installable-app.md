# Feature: Installable app (PWA)

> Last updated: 2026-11-08

## Context

Picsou is mostly opened on a phone, from a browser tab that is easy to lose among others. As an
installable web app it gets its own icon on the home screen and opens full screen, without the
browser's address bar, like a native app, with no app store and no second codebase.

## How it works

- `frontend/public/manifest.json` declares the app to Android and desktop browsers: name, start URL
  `/`, `standalone` display, the dark theme's background as theme and splash colour, and three icons.
- `frontend/index.html` links the manifest and carries the `apple-*` tags iOS needs: Safari ignores
  the manifest's icons and takes `apple-touch-icon` for the home screen.
- `frontend/public/icons/` holds the icons: 192 and 512 px, a 512 px *maskable* variant with a wider
  margin (Android crops icons to a circle or a squircle), and the 180 px Apple touch icon. They are
  the white logo on `#0a0c10`, rendered from `src/assets/picsou_logo_white.svg`.

Installing: Chrome or Edge on Android and desktop offer *Install app* in the menu; on iOS, Safari
*Share → Add to Home Screen*.

### Key files

- `frontend/public/manifest.json` — the web app manifest
- `frontend/public/icons/` — app icons
- `frontend/index.html` — manifest link and iOS tags
- `backend/src/main/java/com/picsou/config/SpaPaths.java` — `.json` counts as a static file

## Technical choices

| Choice | Why | Rejected alternative |
|---|---|---|
| No service worker | Chrome no longer requires one to install; caching a finance app's pages or API answers offline would show stale or another session's figures, and a cached `index.html` can pin an old release after a deploy | `vite-plugin-pwa` / Workbox with an app-shell cache |
| `manifest.json`, not `manifest.webmanifest` | Spring Boot's MIME table has no `webmanifest` entry and no property to add one; `.json` is served as `application/json`, which every browser accepts for a manifest | A `WebServerFactoryCustomizer` adding the MIME mapping |
| `.json` added to `SpaPaths`' static extensions | A missing manifest (or locale file) must answer 404, not the SPA's `index.html` | Leaving the index fallback |
| Dark theme colours only | Dark is the default theme; the manifest takes one theme colour | A `media`-specific `theme-color` per scheme |

## Gotchas / Pitfalls

- **Installing needs a trusted HTTPS origin** (or `localhost`). Behind the bundled Caddy with
  `tls internal`, browsers distrust the certificate until Caddy's root CA is installed on the device;
  until then Chrome does not offer to install, and iOS may drop the certificate exception once the app
  runs from the home screen.
- **Icons are cached hard by the OS.** After changing one, remove and re-add the app.

## Tests

- `SpaResourceResolverTest.aMissingFileWithAStaticExtension_isNotFoundNotTheIndex` — a missing
  `manifest.json` is a 404.
- Checked by hand on the production image: Chrome's `Page.getInstallabilityErrors` reports none.
