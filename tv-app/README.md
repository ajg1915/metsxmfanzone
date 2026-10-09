# MetsXMFanZone TV app

Android TV and Fire TV app. It is a thin shell: it opens `https://metsxmfanzone.com/tv?tv=true`
in a WebView, so every site update shows up without rebuilding the app. The TV home, sign-in and
paid-members check all live in the website code (`src/pages/TVDashboard.tsx`).

Built in GitHub Actions (`.github/workflows/build-tv-app.yml`). The APK is published to the
`tv-app` release and available at https://metsxmfanzone.com/tv-app (short link for the Downloader app).

**Downloader code: `6750144`** (aftv.news/6750144) points to that link. On Fire TV / Android TV, open
Downloader, type 6750144 in the URL box and press Go.

Locally: `npm install`, `npx cap add android`, `node scripts/patch-android.mjs`,
`python3 scripts/make_icons.py`, `npx cap sync android`, then build in Android Studio.
