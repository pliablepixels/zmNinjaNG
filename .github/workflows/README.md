# GitHub Actions Build Workflows

This directory contains automated build workflows for zmNinjaNG across multiple platforms.

## ⚠️ Quick Fix: macOS "Damaged App" Error

If you downloaded a macOS build and get a "damaged" error, that is not because the app is damaged. It is because MacOS blocks you.
In more recent versions this has become painful. I couldn't get `xcattr` variants to work. Anyway, simple answer: use [sentinel](https://github.com/alienator88/Sentinel)

## Available Workflows

### Individual Platform Builds

Each platform has its own dedicated workflow that can be triggered manually or on git tags:

- **`build-android.yml`** - Builds Android APK and AAB
- **`build-macos.yml`** - Builds macOS DMG installer
- **`build-linux.yml`** - Builds Linux AppImage and DEB packages
- **`build-windows.yml`** - Builds Windows MSI and NSIS installers

### Combined Build Workflow

- **`build-all.yml`** - Build multiple platforms in parallel (configurable)

## How to Trigger Builds

### Recommended: Using the Release Script

The easiest way to create a release is using the automated release script:

```bash
# From the project root
./scripts/make_release.sh
```

This script will:
1. Verify all changes are committed and pushed
2. Read the version from `app/package.json`
3. Create a git tag in the format `zmNinjaNG-{version}`
4. Push the tag to trigger all build workflows
5. Create a GitHub Release with build artifacts

**Safety Checks**: The script performs validation before creating a release:
- Fails if there are uncommitted changes
- Fails if there are unpushed commits
- Asks for confirmation before proceeding

**Handling Existing Tags**: If a tag already exists, the script will ask if you want to move it to the current commit. This is useful when you need to rebuild a release with fixes.

### Manual Trigger (Workflow Dispatch)

1. Go to **Actions** tab in GitHub
2. Select the workflow you want to run
3. Click **Run workflow**
4. Enter the version number (e.g., `1.0.0`)
5. For `build-all.yml`, optionally specify platforms (default: all)

### Manual Tag Push (Alternative)

You can also manually push a tag to trigger builds:

```bash
# Tag format must be: zmNinjaNG-{version}
git tag zmNinjaNG-1.0.0
git push origin zmNinjaNG-1.0.0
```

To move an existing tag to a new commit:

```bash
# Delete old tag
git tag -d zmNinjaNG-1.0.0
git push origin --delete zmNinjaNG-1.0.0

# Create new tag and push
git tag zmNinjaNG-1.0.0
git push origin zmNinjaNG-1.0.0 --force
```

This will:
- Trigger all individual platform workflows
- Create a GitHub Release with build artifacts attached

## Build Artifacts

After a successful build, artifacts are available for download:

### Android
- `zmNinjaNG-android-debug-{version}.apk` - Debug-signed APK for sideloading
- `zmNinjaNG-android-debug-{version}.aab` - Debug-signed App Bundle for testing

### macOS
- `zmNinjaNG.dmg` - DMG installer
- `zmNinjaNG.app` - Application bundle

### Linux
- `zmNinjaNG.AppImage` - Universal AppImage
- `zmNinjaNG.deb` - Debian package
- `zmNinjaNG.rpm` - RPM package

### Windows
- `zmNinjaNG.msi` - MSI installer
- `zmNinjaNG.exe` - NSIS installer (if configured)

## Customizing Release Notes

Release notes are automatically generated from commit messages, but you can add custom content:

1. Edit `_RELEASE_NOTE_INSERT.md` in the `.github/workflows/` directory
2. Add installation instructions, warnings, or any other information
3. Commit and push the changes
4. The next release will include your custom notes at the top

The file uses Markdown format and will appear above the auto-generated commit history.

## Build Requirements

### Required: GitHub Actions Permissions

For automated releases to work, you must enable write permissions:

1. Go to repository **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **"Read and write permissions"**
4. Click **Save**

Without this, you'll get 403 errors when trying to create releases.

### Android
- No additional secrets required
- Builds debug-signed APK and AAB by default
- For release signing, configure signing in `app/android/app/build.gradle`

### Desktop Platforms (macOS, Linux, Windows)
- Uses Tauri for desktop builds
- **All builds are unsigned by default** (no secrets required)
- Linux builds work without issues
- macOS/Windows builds will require users to bypass security warnings (see below)
- **Optional macOS Code Signing** (to avoid "damaged" error):
  - `APPLE_CERTIFICATE` - Base64-encoded .p12 certificate
  - `APPLE_CERTIFICATE_PASSWORD` - Certificate password
  - `APPLE_SIGNING_IDENTITY` - Developer ID (e.g., "Developer ID Application: Your Name (TEAM_ID)")
  - `APPLE_ID` - Apple ID email
  - `APPLE_PASSWORD` - App-specific password
  - `APPLE_TEAM_ID` - Team ID from Apple Developer account
- **Optional Tauri updater signing**:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Firebase Configuration

**Important**: Ensure `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are properly configured in your repository for push notifications to work.

See `ANDROID_BUILD.md` for Firebase setup instructions.

## Customization

### Changing Build Settings

- **Android**: Edit `app/android/app/build.gradle`
- **Desktop**: Edit `app/src-tauri/tauri.conf.json`

### Adding Code Signing

For production releases, you should configure code signing:

**Android**: Add signing configuration to gradle
**macOS**: Set up Apple Developer certificates
**Windows**: Configure code signing certificate

See Tauri documentation for details: https://tauri.app/v1/guides/distribution/sign-your-application

## macOS "Damaged" App Error

If you get a **"zmNinjaNG.app is damaged and can't be opened. You should move it to the Trash"** error, this is because the app is not signed/notarized. You have two options:


### Option 1: Bypass Security
Use [Sentinel](https://github.com/alienator88/Sentinel)

### Option 2: Set Up Code Signing (Recommended for Distribution)

To produce properly signed and notarized builds:

1. **Get Apple Developer Account** ($99/year)

2. **Create Developer ID Certificate**:
   - Go to Apple Developer Portal → Certificates
   - Create "Developer ID Application" certificate
   - Download and install in Keychain

3. **Export Certificate**:
   ```bash
   # Export from Keychain as .p12
   # Then convert to base64
   base64 -i certificate.p12 | pbcopy
   ```

4. **Create App-Specific Password**:
   - Go to appleid.apple.com
   - Sign In → Security → App-Specific Passwords
   - Generate password for "GitHub Actions"

5. **Add GitHub Secrets**:
   - Go to repository Settings → Secrets → Actions
   - Add the following secrets:
     - `APPLE_CERTIFICATE`: Paste base64 certificate
     - `APPLE_CERTIFICATE_PASSWORD`: Certificate password
     - `APPLE_SIGNING_IDENTITY`: "Developer ID Application: Your Name (TEAM_ID)"
     - `APPLE_ID`: Your Apple ID email
     - `APPLE_PASSWORD`: App-specific password
     - `APPLE_TEAM_ID`: Team ID from developer portal

6. **Re-run Workflow** - The app will now be signed and notarized

## Troubleshooting

### Build Fails

Check the Actions tab for detailed error logs. Common issues:

- **Missing dependencies**: Check Node.js/Rust versions
- **Build errors**: Ensure local builds work first
- **Artifact upload fails**: Check file paths match your build output

### Android Build Issues

- Ensure `google-services.json` exists at `app/android/app/google-services.json`
- Verify Java 17 is being used
- Check Gradle version compatibility

### Desktop Build Issues

- Ensure Rust toolchain is properly installed
- Check Tauri configuration in `tauri.conf.json`
- Verify all platform-specific dependencies are installed

## Local Testing

Before pushing, test builds locally:

```bash
# Android
cd app
npm run android:release

# Desktop (macOS/Linux/Windows)
cd app
npm run tauri:build
```

## More Information

- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Tauri Build Documentation](https://tauri.app/v1/guides/building/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
