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

PACKAGE_VERSION="$(node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const tauri = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
if (!pkg.version || !tauri.version) {
  console.error("Error: version field is missing in package.json or src-tauri/tauri.conf.json");
  process.exit(1);
}
if (pkg.version !== tauri.version) {
  console.error(`Error: version mismatch: package.json=${pkg.version}, src-tauri/tauri.conf.json=${tauri.version}`);
  process.exit(1);
}
process.stdout.write(pkg.version);
')"

CARGO_VERSION="$(perl -ne '
if (/^\[package\]/) { $in_package = 1; next; }
if ($in_package && /^\[/) { $in_package = 0; }
if ($in_package && /^\s*version\s*=\s*\"([^\"]+)\"/) { print $1; exit; }
' src-tauri/Cargo.toml)"

if [[ -z "${CARGO_VERSION:-}" ]]; then
  echo "Error: failed to read package version from src-tauri/Cargo.toml"
  exit 1
fi

if [[ "$CARGO_VERSION" != "$PACKAGE_VERSION" ]]; then
  echo "Error: version mismatch: src-tauri/Cargo.toml=${CARGO_VERSION}, package.json=${PACKAGE_VERSION}"
  exit 1
fi

DEFAULT_VERSION=""
if [[ "$PACKAGE_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  DEFAULT_VERSION="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
fi

if [[ -n "$DEFAULT_VERSION" ]]; then
  read -r -p "Version [${DEFAULT_VERSION}] (current: ${PACKAGE_VERSION}): " VERSION
  VERSION="${VERSION:-$DEFAULT_VERSION}"
else
  read -r -p "Version (example: 0.1.1, current: ${PACKAGE_VERSION}): " VERSION
fi

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

VERSION="$VERSION" perl -0777 -i -pe 's/(\[package\]\n(?:.*?\n)*?version\s*=\s*")[^"]+(")/${1}$ENV{VERSION}${2}/s' src-tauri/Cargo.toml

if ! cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps >/dev/null 2>&1; then
  echo "Error: src-tauri/Cargo.toml became invalid after version update."
  rm -f "$NOTES_FILE"
  exit 1
fi

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
FILES_TO_COMMIT=(
  "package.json"
  "src-tauri/Cargo.toml"
  "src-tauri/tauri.conf.json"
)

if [[ -f "pnpm-lock.yaml" ]]; then
  FILES_TO_COMMIT+=("pnpm-lock.yaml")
fi

if [[ -f "src-tauri/Cargo.lock" ]]; then
  FILES_TO_COMMIT+=("src-tauri/Cargo.lock")
fi

git add "${FILES_TO_COMMIT[@]}"
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
