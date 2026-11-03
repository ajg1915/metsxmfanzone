# MetsXMFanZone mobile app (Android)

Phone and tablet app. It is a thin shell: it opens `https://metsxmfanzone.com/` in a WebView, so every
site update (live game popup, menus, guide) shows up without rebuilding the app. Only things in the
native shell itself (icon, version, permissions) need a rebuild.

Built in GitHub Actions (`.github/workflows/build-mobile-app.yml`) and published to the `android-app`
release, available at https://metsxmfanzone.com/android-app. Run it by hand from the Actions tab, or it
runs when files in `mobile-app/` change.

The APK is signed with the debug key. If the phone already has a copy signed with a different key,
uninstall it first, then install the new one.

Locally: `npm install`, `npx cap add android`, `node scripts/patch-android.mjs`,
`python3 scripts/make_icons.py`, `npx cap sync android`, then build in Android Studio.
