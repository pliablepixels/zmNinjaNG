#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

PKG_JSON="app/package.json"
SYNC_SCRIPT="scripts/sync-version.js"

# --- Read version ---
get_version() {
  if [ -f "$PKG_JSON" ]; then
    grep '"version":' "$PKG_JSON" | head -1 | awk -F: '{ print $2 }' | sed 's/[", ]//g'
  else
    echo "NONE"
  fi
}

# --- Update version in package.json, then sync to tauri files ---
set_version() {
    local new_ver="$1"
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${new_ver}\"/" "$PKG_JSON"
    node "$SYNC_SCRIPT"
    # Regenerate Cargo.lock
    echo "  Updating Cargo.lock..."
    (cd app/src-tauri && cargo generate-lockfile 2>/dev/null) || true
}

VERSION=$(get_version)
if [[ "$VERSION" == "NONE" ]]; then
    echo "$PKG_JSON not found. Run ./scripts/make_release.sh from the project root."
    exit 1
fi

TAG="zmNinjaNG-$VERSION"

echo "==================================================="
echo "   ZoneMinder Next Gen (zmNinjaNG) Release Script"
echo "==================================================="
echo "Detected Version: $VERSION"
echo "Target Tag:       $TAG"
echo "==================================================="
echo ""

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# --- Step 1: Check if tag already exists ---
TAG_EXISTS=false
if git rev-parse "$TAG" >/dev/null 2>&1; then
    TAG_EXISTS=true
fi
if git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
    TAG_EXISTS=true
fi

if [ "$TAG_EXISTS" = true ]; then
    # Compute bumped patch version
    MAJOR=$(echo "$VERSION" | cut -d. -f1)
    MINOR=$(echo "$VERSION" | cut -d. -f2)
    PATCH=$(echo "$VERSION" | cut -d. -f3)
    BUMPED="${MAJOR}.${MINOR}.$((PATCH + 1))"

    echo "⚠️  Tag '$TAG' already exists."
    echo "  1) Bump version: $VERSION -> $BUMPED"
    echo "  2) Move existing tag to current commit (overwrite)"
    read -p "Choose [1/2] or anything else to abort: " choice
    case "$choice" in
        1)
            echo ""
            echo "Bumping version: $VERSION -> $BUMPED"
            set_version "$BUMPED"
            VERSION="$BUMPED"
            TAG="zmNinjaNG-$VERSION"
            git add "$PKG_JSON" app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/ios/App/App.xcodeproj/project.pbxproj app/android/app/build.gradle
            git commit -m "chore: bump version to $VERSION"
            git push origin "$CURRENT_BRANCH"
            echo "✅ Version bumped to $VERSION, committed and pushed"
            echo ""
            ;;
        2)
            echo ""
            echo "Will move tag '$TAG' to current commit."
            echo ""
            ;;
        *)
            echo "Aborted."
            exit 0
            ;;
    esac
fi

# --- Step 2: Check for uncommitted changes ---
DIRTY_FILES=$(git status --porcelain)
if [ -n "$DIRTY_FILES" ]; then
    echo "❌ Error: You have uncommitted changes in your working directory."
    echo ""
    git status --short
    echo ""
    echo "Please commit or stash your changes before creating a release."
    exit 1
fi

# Check if branch has an upstream
if ! git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    echo "❌ Error: Current branch '$CURRENT_BRANCH' has no upstream branch."
    echo ""
    echo "Please push your branch first:"
    echo "  git push -u origin $CURRENT_BRANCH"
    echo ""
    exit 1
fi

# Check for unpushed commits
UNPUSHED=$(git rev-list @{u}..HEAD --count)
if [[ "$UNPUSHED" -gt 0 ]]; then
    echo "❌ Error: You have $UNPUSHED unpushed commit(s) on branch '$CURRENT_BRANCH'."
    echo ""
    echo "Please push your commits before creating a release:"
    echo "  git push origin $CURRENT_BRANCH"
    echo ""
    exit 1
fi

echo "✅ Working directory is clean"
echo "✅ All commits are pushed to origin"
echo ""

# --- Confirm before proceeding ---
REMOTE_URL=$(git remote get-url origin)
echo "--- Release summary ---"
echo "  Version:  $VERSION"
echo "  Tag:      $TAG"
echo "  Branch:   $CURRENT_BRANCH"
echo "  Remote:   $REMOTE_URL"
echo ""
echo "This will:"
echo "  1. Generate CHANGELOG.md"
echo "  2. Create and push git tag '$TAG'"
echo "  3. Trigger GitHub Actions to build and create release"
echo ""
read -p "Proceed? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# --- Step 3: Generate changelog ---
if [ -f "Gemfile" ] && command -v bundle &> /dev/null; then
    echo ""
    echo "📋 Generating CHANGELOG.md..."
    if CHANGELOG_GITHUB_TOKEN=$(gh auth token 2>/dev/null) bundle exec github_changelog_generator --future-release "$TAG"; then
        if [[ -n $(git diff --name-only CHANGELOG.md 2>/dev/null) ]] || [[ -n $(git ls-files --others --exclude-standard CHANGELOG.md 2>/dev/null) ]]; then
            echo "📝 CHANGELOG.md updated, committing..."
            git add CHANGELOG.md
            git commit -m "chore: update CHANGELOG.md for $TAG"
            git push origin "$CURRENT_BRANCH"
            echo "✅ CHANGELOG.md committed and pushed"
        else
            echo "ℹ️  CHANGELOG.md unchanged"
        fi
    else
        echo "❌ Changelog generation failed"
        exit 1
    fi
else
    echo ""
    echo "❌ Gemfile or bundler not found"
    echo "   Run: bundle install"
    exit 1
fi

# --- Step 4: Tag ---
if [ "$choice" = "2" ]; then
    echo ""
    echo "Removing existing tag $TAG..."
    git tag -d "$TAG" 2>/dev/null || true
    git push origin --delete "$TAG" 2>/dev/null || true
fi

echo ""
echo "Creating tag $TAG..."
git tag "$TAG"

echo "Pushing tag to origin..."
git push origin "$TAG" --force

echo ""
echo "✅ Release triggered! Check GitHub Actions for progress."
echo "   https://github.com/pliablepixels/zmNinjaNG/actions"
echo ""
echo "The create-release workflow will:"
echo "  - Generate release notes with changelog"
echo "  - Create the GitHub Release"
echo "  - Build workflows will attach platform binaries"
