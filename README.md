# zmNinjaNG - Modern ZoneMinder Client

[![Build Android](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-android.yml/badge.svg)](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-android.yml)
[![Build macOS](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-macos.yml/badge.svg)](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-macos.yml)
[![Build Windows](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-windows.yml/badge.svg)](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-windows.yml)
[![Build Linux](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-linux-amd64.yml/badge.svg)](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/build-linux-amd64.yml)
[![Tests](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/test.yml/badge.svg)](https://github.com/pliablepixels/zmNinjaNG/actions/workflows/test.yml)
[![GitHub release](https://img.shields.io/github/v/release/pliablepixels/zmNinjaNG)](https://github.com/pliablepixels/zmNinjaNG/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/pliablepixels/zmNinjaNG/total?cache=none)](https://github.com/pliablepixels/zmNinjaNG/releases)

<img src="app/assets/logo.png" align="right" width="120" />

A modern web and mobile application for ZoneMinder, providing a clean, intuitive interface for viewing live camera feeds, reviewing events, and managing multiple server profiles. It is a ground-up rewrite of the original [zmNinja](https://zmninja.zoneminder.com/) application, using modern web technologies and a more intuitive user interface. 

Watch a video of the demo [HERE](https://youtu.be/ces_2ap-htc)

### Screenshots
<sub><sup>frames courtesy [appleframer](https://appleframer.com/)</sup></sub>

<p align="center">
  <img src="images/1.png" width="32%" />
  <img src="images/2.png" width="32%" />
  <img src="images/3.png" width="32%" />
</p>
<p align="center">
  <img src="images/4.png" width="32%" />
  <img src="images/5.png" width="32%" />
  <img src="images/6.png" width="32%" />
</p>
<p align="center">
  <img src="images/7.png" width="32%" />
  <img src="images/8.png" width="32%" />
  <img src="images/9.png" width="32%" />
</p>


### Agentic AI, you and me

Agentic AI and me: I built the very first version of zmNinja over several months and built in more features over multiple years. I built the first version of zmNinjaNG over 2.5 days with almost as many features as the last version of zmNinja. Thanks to Claude.

Agentic AI and you: I don't plan to support zmNinjaNG at all. Please don't ping me and expect quick answers. 
Instead, treat this as "personal software" - i.e. download the code and fix it yourself. If you don't code, or do code, but aren't familiar with the environment of zmNinjaNG, I'd encourage you to use an agentic AI tool to help you along the way. Pick one you prefer. Remember, for mobile support, you'll need to generate your own FCM tokens. See mobile guides later for more.


#### Pull Requests

I am happy to accept PRs, but I don't want [AI slop](https://en.wikipedia.org/wiki/AI_slop). Funny I am saying this, given this repo is largely AI agent(s) generated. The difference is I understand the code and know how to prompt it with directions that make the tools generate better quality code. Remember these tools are amazing but love to write a lot of code doing custom things when simpler/better means are available. They also make mistakes. So here are the rules:

- If you have not read and understood the code you generated, please don't PR it to my repo. Please continue to extend it yourself
- See my agent rules for [CLAUDE](AGENTS.md) here - please make sure to use it in your agent
- Before you PR, please do a code review

### Limitations & Notes
- Self signed/untrusted certificates are not supported. It's not worth the effort to support them. Please use LetsEncrypt or other free certs, or just use http.
- If you want push notifications, you'll have to use a newer [Event Server](https://zmeventnotificationv7.readthedocs.io/en/latest/)


## Quick Start

### Binaries
- Download binaries from [zmNinjaNG Releases](https://github.com/pliablepixels/zmNinjaNG/releases)
- iOS will be in the app store soon. Isaac is on it.
- I use Github workflows and runners to automatically build release binaries [here](https://github.com/pliablepixels/zmNinjaNG/tree/main/.github/workflows). Binaries are built for specific platforms. If the binary doesn't work for your linux distro, look at those files

## Build from Source

### Prerequisites
- Node.js ^20.19.0 || >=22.12.0 and npm ([download](https://nodejs.org/en/download))
- For desktop builds: Rust toolchain (for Tauri builds)

### GitHub Actions Setup (For Automated Releases)

If you're setting up automated builds via GitHub Actions, you need to enable write permissions:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **General**
3. Scroll down to **Workflow permissions**
4. Select **"Read and write permissions"**
5. Check **"Allow GitHub Actions to create and approve pull requests"** (optional)
6. Click **Save**

This allows the workflows to create GitHub releases automatically when you push a tag.

### Desktop Development

```bash
git clone https://github.com/pliablepixels/zmNinjaNG
cd zmNinjaNG/app
npm install

# Desktop development (Tauri - native app)
npm run tauri:dev
```

### Desktop Production Builds

#### Desktop production build (Tauri): Recommended
```bash
npm run tauri:build    # Output: src-tauri/target/release/bundle/
```
#### Web production build
```bash
npm run build          # Output: dist/
npm run preview        # Preview production build
```
Deploy web build (`dist/`) to: Netlify, Vercel, GitHub Pages, AWS S3, etc.

### Mobile Builds

- For Android setup and builds, see [ANDROID](docs/building/ANDROID.md)
- For iOS setup and builds, see [IOS](docs/building/IOS.md)

## Testing

The project includes unit tests and end-to-end (E2E) tests to ensure code quality and reliability.

### Unit Tests

Run unit tests with Vitest:

```bash
cd zmNinjaNG/app

# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit -- --watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm run test:unit -- src/lib/__tests__/url-builder.test.ts
```

Coverage reports are generated in `coverage/` directory.

### End-to-End Tests

Run E2E tests with Playwright:

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode (visual debugging)
npm run test:e2e:ui

# Run specific test file
npm run test:e2e -- tests/monitors.spec.ts
```

**Note:** E2E tests require a running ZoneMinder server. Configure test credentials in `.env` file (see `.env.example`).

### Run All Tests

```bash
# Run both unit and E2E tests
npm run test:all
```

### Documentation

```bash
pip install -r docs/requirements.txt sphinx-autobuild && cd docs && make clean && make html && sphinx-autobuild . _build/html
```

### Making releases
- See `scripts/make_release.sh` [here](scripts/make_release.sh). This automatically tags the current state and triggers release builds
- `app/package.json` is the source of truth for the version number. `scripts/sync-version.js` propagates it to `app/src-tauri/tauri.conf.json` and `app/src-tauri/Cargo.toml` during builds and releases

### New vs Old
[View Comparison with zmNinja](notes/COMPARISON.md)


