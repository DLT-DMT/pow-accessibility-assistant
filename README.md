# DMT FOH Shift Guide

Static offline PWA for guided Front of House shift support.

Version: `3.0.0`

## What Changed In Version 3

- Renamed the app to DMT FOH Shift Guide.
- Added full track overview cards with RAG status and counters.
- Combined Walking Stick and Rollator into one working profile.
- Expanded cleaning schedule references into operational cleaning task lists.
- Added Quick Reference for 999 calls, muster points, and radio codes.
- Added What's New release notes beside the version number.

## Structure

- `.nojekyll` - tells GitHub Pages to publish static files directly
- `DEPLOYMENT_GUIDE.md` - step-by-step GitHub Pages publishing guide
- `index.html` - app shell
- `style.css` - visual styling
- `app.js` - guided workflow and shift rendering
- `manifest.json` - installable PWA metadata
- `service-worker.js` - offline cache
- `version.js` - release version used by the app and service worker
- `data/master-data.json` - refined Version 3 app data
- `data/master-data.js` - browser-safe local data file used by the app
- `assets/` - theatre image and attribution
- `icons/` - PWA icons

## Deployment

Follow `DEPLOYMENT_GUIDE.md`.

The target host is GitHub Pages with:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/(root)`

## Updating Data

The app reads `data/master-data.js` first so it works when `index.html` is opened directly from the folder.

To update the data, replace `data/master-data.js` with the same global variable name:

```js
window.POW_MASTER_DATA = { ... };
```

`data/master-data.json` is kept as an editable source/export copy.

## Updating The App Version

For every release, edit `version.js`:

```js
globalThis.POW_APP_VERSION = "2.0.1";
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
