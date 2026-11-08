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
  // Keep audio playing in the background (Listen mode): a "listening live" notification service.
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK",
];
for (const name of permissions) {
  if (!xml.includes(name)) {
    xml = xml.replace("</manifest>", `    <uses-permission android:name="${name}" />\n</manifest>`);
  }
}
// The background-audio service, and the native code that lets the website start it.
if (!xml.includes("com.metsxmfanzone.app.ListenService") && !xml.includes('android:name=".ListenService"')) {
  xml = xml.replace(
    "</application>",
    '    <service android:name=".ListenService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n    </application>'
  );
}
fs.writeFileSync(manifestPath, xml);
const javaDir = path.resolve("android/app/src/main/java/com/metsxmfanzone/app");
fs.mkdirSync(javaDir, { recursive: true });
for (const file of ["MainActivity.java", "ListenService.java", "ListenServicePlugin.java"]) {
  fs.copyFileSync(path.resolve("native", file), path.join(javaDir, file));
}

// Logo shown on the lock-screen player.
const drawDir = path.resolve("android/app/src/main/res/drawable-nodpi");
fs.mkdirSync(drawDir, { recursive: true });
fs.copyFileSync(path.resolve("native/listen_logo.png"), path.join(drawDir, "listen_logo.png"));

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
if (!xml.includes("ListenService") || !xml.includes("FOREGROUND_SERVICE_MEDIA_PLAYBACK")) {
  console.error("Background audio patch failed");
  process.exit(1);
}
console.log(`Mobile app patched: version 2.0.${run}`);
