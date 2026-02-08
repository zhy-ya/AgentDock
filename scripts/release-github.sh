#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required."
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "Error: gh auth is not ready. Run: gh auth login -h github.com"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: current directory is not a git repository."
  exit 1
fi

DIRTY_OUTPUT="$(git status --porcelain --untracked-files=all | grep -vE '^\?\? release/' || true)"
if [[ -n "$DIRTY_OUTPUT" ]]; then
  echo "Error: working tree is not clean."
  echo "$DIRTY_OUTPUT"
  echo "Commit or stash changes first."
  exit 1
fi

read -r -p "Version (example: 0.1.1): " VERSION
if [[ -z "${VERSION:-}" ]]; then
  echo "Error: version is required."
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([\-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: invalid semver version: $VERSION"
  exit 1
fi

TAG="v$VERSION"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: local tag already exists: $TAG"
  exit 1
fi

if git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG"; then
  echo "Error: remote tag already exists: $TAG"
  exit 1
fi

echo "Enter release notes. Press Ctrl-D when finished:"
NOTES_FILE="$(mktemp)"
cat > "$NOTES_FILE"
if [[ ! -s "$NOTES_FILE" ]]; then
  echo "Error: release notes cannot be empty."
  rm -f "$NOTES_FILE"
  exit 1
fi

echo "Updating versions to $VERSION ..."
node -e '
const fs = require("fs");
const version = process.argv[1];
for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
' "$VERSION"

perl -0777 -i -pe 's/(\[package\]\n(?:.*\n)*?version = ")[^"]+(")/$1'"$VERSION"'$2/s' src-tauri/Cargo.toml

echo "Building app bundle ..."
pnpm tauri build --bundles app

APP_PATH="src-tauri/target/release/bundle/macos/AgentDock.app"
ZIP_PATH="release/AgentDock_${VERSION}_aarch64.app.zip"
SHA_PATH="${ZIP_PATH}.sha256"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: app bundle not found: $APP_PATH"
  rm -f "$NOTES_FILE"
  exit 1
fi

mkdir -p release
rm -f "$ZIP_PATH" "$SHA_PATH"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
shasum -a 256 "$ZIP_PATH" > "$SHA_PATH"

echo "Committing release changes ..."
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "release: $TAG"

echo "Tagging and pushing ..."
git tag -a "$TAG" -m "Release $TAG"
CURRENT_BRANCH="$(git branch --show-current)"
git push origin "$CURRENT_BRANCH"
git push origin "$TAG"

echo "Creating GitHub release ..."
gh release create "$TAG" \
  "$ZIP_PATH" \
  "$SHA_PATH" \
  --title "AgentDock $TAG" \
  --notes-file "$NOTES_FILE"

rm -f "$NOTES_FILE"
echo "Release completed: $TAG"
