import { mkdir, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

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

// Use the designed Trail Events mountain-runner artwork as the actual iOS icon.
const iconPng = join(webDir, "trail-app-icon-1024.png");
const iconSvg = (await readFile(join(root, "trail-icon.svg"), "utf8"))
  .replace(' clip-path="url(#round)"', "");
await sharp(Buffer.from(iconSvg))
  .resize(1024, 1024, { fit: "cover", background: "#14251f" })
  .png()
  .toFile(iconPng);

const iosIconSet = join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
try {
  await mkdir(iosIconSet, { recursive: true });
  await copyFile(iconPng, join(iosIconSet, "AppIcon-512@2x.png"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

console.log("Prepared web assets and Trail Events iOS app icon.");
