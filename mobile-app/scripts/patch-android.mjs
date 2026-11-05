// Run after `npx cap add android`. Sets the app version, and asks Android for notifications and microphone access.
import fs from "node:fs";
import path from "node:path";

const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
const gradlePath = path.resolve("android/app/build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${100 + run}`).replace(/versionName\s+"[^"]*"/, `versionName "2.0.${run}"`);
fs.writeFileSync(gradlePath, gradle);

const manifestPath = path.resolve("android/app/src/main/AndroidManifest.xml");
let xml = fs.readFileSync(manifestPath, "utf8");
// Notifications (Android 13+), and the microphone so the podcast can go live from the phone.
const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
];
for (const name of permissions) {
  if (!xml.includes(name)) {
    xml = xml.replace("</manifest>", `    <uses-permission android:name="${name}" />\n</manifest>`);
  }
}
fs.writeFileSync(manifestPath, xml);

// Plain PNG launcher icons (made by make_icons.py) instead of the Capacitor adaptive icon.
const anydpi = path.resolve("android/app/src/main/res/mipmap-anydpi-v26");
if (fs.existsSync(anydpi)) fs.rmSync(anydpi, { recursive: true, force: true });

if (!fs.readFileSync(gradlePath, "utf8").includes(`versionName "2.0.${run}"`)) {
  console.error("Version patch failed");
  process.exit(1);
}
if (!xml.includes("android.permission.RECORD_AUDIO")) {
  console.error("Microphone permission patch failed");
  process.exit(1);
}
console.log(`Mobile app patched: version 2.0.${run}`);
