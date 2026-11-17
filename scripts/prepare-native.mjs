import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const webDir = join(root, "www");
await mkdir(webDir, { recursive: true });

const requiredFiles = [
  "index.html",
  "event-dates.json",
  "manifest.webmanifest",
  "trail-icon.svg",
  "trail-apple-touch-icon.png"
];

for (const file of requiredFiles) {
  await copyFile(join(root, file), join(webDir, file));
}

console.log(`Prepared ${requiredFiles.length} web assets in www/ for Capacitor.`);
