# Installation

## Pre-built Binaries

Download the latest release for your platform from [GitHub Releases](https://github.com/pliablepixels/zmNinjaNG/releases).

### Android

1. Download the `.apk` file from the releases page
2. On your device, enable **Install from unknown sources** (Settings > Security)
3. Open the downloaded APK to install
4. Launch zmNinjaNG and set up your first {doc}`profile <profiles>`

:::{note}
Push notifications require building the app yourself with your own Firebase credentials. See {doc}`../building/ANDROID`. Web-based (foreground) notifications work without a custom build.
:::

### Windows

1. Download the `.msi` or `.exe` installer from the releases page
2. Run the installer
3. Launch zmNinjaNG from the Start menu

### macOS

1. Download the `.dmg` file from the releases page
2. Open the DMG and drag zmNinjaNG to your Applications folder
3. On first launch, you may need to right-click > Open to bypass Gatekeeper (the app is not notarized)

### Linux

1. Download the `.deb` (Debian/Ubuntu) or `.AppImage` (universal) from the releases page
2. Install:
   - **Debian/Ubuntu**: `sudo dpkg -i zmNinjaNG_*.deb`
   - **AppImage**: `chmod +x zmNinjaNG_*.AppImage && ./zmNinjaNG_*.AppImage`

:::{tip}
If the pre-built binary doesn't work on your Linux distribution, check the [GitHub Actions workflows](https://github.com/pliablepixels/zmNinjaNG/tree/main/.github/workflows) for build details and adjust for your system.
:::

### iOS

iOS binaries are **not** published on the releases page. You must build from source with your own Apple Developer account. See {doc}`../building/IOS`.

## Web Deployment

You can also host zmNinjaNG as a web application.

### Build from Source

```bash
git clone https://github.com/pliablepixels/zmNinjaNG
cd zmNinjaNG/app
npm install
npm run build
```

The `dist/` folder contains the static files. Deploy to any web server or hosting service (Netlify, Vercel, GitHub Pages, nginx, Apache, etc.).

### Example: nginx

```nginx
server {
    listen 80;
    server_name zmng.example.com;
    root /var/www/zmng/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Build from Source (Desktop)

```bash
git clone https://github.com/pliablepixels/zmNinjaNG
cd zmNinjaNG/app
npm install
npm run tauri:build
```

The built application will be in `app/src-tauri/target/release/bundle/`.

See {doc}`../building/index` for detailed platform-specific instructions.

## Updating

### Binaries

Download the new version from the releases page and install it over the existing installation. Your profiles and settings are preserved - they are stored in the browser/app local storage, not in the application files.

### Web Deployment

Rebuild from source and replace the `dist/` folder contents.
