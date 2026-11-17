# Trail Events – iOS App Store build

This repository now contains the Capacitor foundation for a real iOS application.

## App identity

- Display name: Trail Events
- Bundle identifier: `de.mitschi77.trailevents`
- Native runtime: Capacitor 7
- Existing web application: `index.html`

The bundle identifier must be confirmed as available in the Apple Developer account before App Store Connect registration. Changing it later is possible but should be avoided after release.

## Generate and open the iOS project

Requirements: macOS, current Xcode, Xcode Command Line Tools, and Node.js 20 or newer.

```bash
npm install
npm run ios:add
npm run ios:open
```

For subsequent web-app changes:

```bash
npm run ios:sync
```

## Before App Store submission

1. Confirm the Apple Developer account and bundle identifier.
2. Replace/confirm the final 1024×1024 app icon artwork. Do not ship the current placeholder artwork without approval.
3. Configure signing in Xcode using the developer's Apple Team.
4. Test on a physical iPhone: login, cloud sync, GPX import, map display, offline behavior, data persistence, and navigation.
5. Add the required privacy disclosures, support URL, privacy policy, age rating, screenshots, and App Store metadata in App Store Connect.
6. Archive and upload using Xcode; complete App Review submission.

## Important implementation notes

- The app currently relies on the existing Supabase authentication and per-user planner storage. The database policies and two-account isolation must be verified before release.
- Leaflet map tiles and some libraries are loaded from the internet. Map behavior without connectivity must be tested and clearly handled.
- The iOS app uses its own WebView storage. Existing Safari localStorage data does not automatically migrate into the native app. Provide an explicit backup/import migration path before first public release.
- The native app project must be generated and signed on macOS with Xcode. Repository changes alone cannot produce an App Store-ready signed IPA.
