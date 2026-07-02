# Prince of Wales Accessibility Assistant

Static offline PWA for daily Front of House accessibility track checks.

Version: `1.0.0`

## Structure

- `.nojekyll` - tells GitHub Pages to publish static files directly
- `DEPLOYMENT_GUIDE.md` - step-by-step GitHub Pages publishing guide
- `index.html` - app shell
- `style.css` - visual styling
- `app.js` - search, filtering and profile rendering
- `manifest.json` - installable PWA metadata
- `service-worker.js` - offline cache
- `version.js` - release version used by the app and service worker
- `data/tracks.json` - accessibility and standard track data
- `data/tracks-data.js` - browser-safe local data file used by the app
- `assets/` - theatre image and attribution
- `icons/` - PWA icons

## Deployment

Follow `DEPLOYMENT_GUIDE.md`.

The target host is GitHub Pages with:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/(root)`

## Updating Data

For Version 1 portability, the app reads `data/tracks-data.js` first.

To update the data, replace `data/tracks-data.js` with the same global variable name:

```js
window.POW_ACCESSIBILITY_DATA = { ... };
```

`data/tracks.json` is kept as an editable source/export copy.

## Updating The App Version

For every release, edit `version.js`:

```js
globalThis.POW_APP_VERSION = "1.0.1";
```

Installed users will be offered an update after GitHub Pages publishes the new files and they open the app while online.

## Opening Locally

Double-click `index.html` to open and use the app directly from the folder.

No local server is required.

## Installing On iPhone

1. Put this folder on a static HTTPS host.
2. Open `index.html` in Safari from that HTTPS URL.
3. Wait for the first page load to finish.
4. Tap Share.
5. Tap Add to Home Screen.
6. Open the installed app once while online.
7. It will then continue to work offline.

## Offline Notes

The app can be used by double-clicking `index.html`.

For iPhone Home Screen installation, Safari still requires the app to be opened from HTTPS once so the PWA service worker can be installed.

After installation and first load:

- Node.js is not required.
- A server is not required for daily use.
- Cloudflare, Vinext and Next.js are not required.
- The cached app shell, data, image and icons continue to work offline.
