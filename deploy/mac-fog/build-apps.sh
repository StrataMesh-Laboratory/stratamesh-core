#!/bin/bash
# Build Finder .app bundles into ~/Applications/StrataMesh and (if writable) /Applications/StrataMesh.
# Ad-hoc codesign + strip quarantine. No Xcode. No secrets.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
DEST_USER="$HOME/Applications/StrataMesh"
DEST_SYS="/Applications/StrataMesh"
VER="${FOG_APP_VERSION:-7}"
SHORT="${FOG_APP_SHORT:-0.2.3}"

write_plist() {
  local dest="$1" name="$2" ident="$3" execn="$4"
  cat > "$dest" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>${execn}</string>
  <key>CFBundleIdentifier</key><string>${ident}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>${name}</string>
  <key>CFBundleDisplayName</key><string>${name}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${SHORT}</string>
  <key>CFBundleVersion</key><string>${VER}</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppleEventsUsageDescription</key>
  <string>StrataMesh Fog opens Terminal for the runtime UI.</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
</dict></plist>
EOF
}

make_app() {
  local dir="$1" name="$2" ident="$3" execn="$4"
  local app="$dir/${execn}.app"
  mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
  write_plist "$app/Contents/Info.plist" "$name" "$ident" "$execn"
  cat > "$app/Contents/PkgInfo" <<'EOF'
APPL????
EOF
}

DEST="$DEST_USER"
mkdir -p "$DEST"
if mkdir -p "$DEST_SYS" 2>/dev/null; then
  DEST="$DEST_SYS"
fi

# --- Fog Stay Awake ---
make_app "$DEST" "Fog Stay Awake" "pt.calhegasmorais.fog.stayawake" "FogStayAwake"
cat > "$DEST/FogStayAwake.app/Contents/MacOS/FogStayAwake" <<'EOS'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
CMD="$FOG/repo/deploy/mac-fog/FogStayAwake.command"
[[ -x "$CMD" ]] || CMD="$HOME/StrataMesh/fog/repo/deploy/mac-fog/FogStayAwake.command"
if [[ ! -f "$CMD" ]]; then
  osascript -e 'display dialog "Fog repo missing. Run Fog Installer first." buttons {"OK"} default button 1' >/dev/null
  exit 1
fi
bash "$CMD" --no-tui || true
osascript >/dev/null <<APP
tell application "Terminal"
  activate
  do script "export FOG_HOME='$FOG'; bash '$CMD'"
end tell
APP
osascript -e 'display notification "Stay-awake loaded (caffeinate). Lid+battery still sleeps." with title "StrataMesh Fog"' >/dev/null 2>&1 || true
EOS
chmod 755 "$DEST/FogStayAwake.app/Contents/MacOS/FogStayAwake"

# --- Fog Runtime ---
make_app "$DEST" "Fog Runtime" "pt.calhegasmorais.fog.runtime" "FogRuntime"
cat > "$DEST/FogRuntime.app/Contents/MacOS/FogRuntime" <<'EOS'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
TUI="$FOG/bin/fog-tui.py"
[[ -f "$TUI" ]] || TUI="$FOG/repo/deploy/mac-fog/fog-tui.py"
CMD="$FOG/bin/FogRuntime.command"
[[ -f "$CMD" ]] || CMD="$FOG/repo/deploy/mac-fog/FogRuntime.command"
if [[ ! -f "$TUI" ]]; then
  osascript -e 'display dialog "fog-tui.py missing. Run Fog Installer first." buttons {"OK"} default button 1' >/dev/null
  exit 1
fi
if [[ -f "$CMD" ]]; then
  osascript >/dev/null <<APP
tell application "Terminal"
  activate
  do script "export FOG_HOME='$FOG'; bash '$CMD'"
end tell
APP
  exit 0
fi
osascript >/dev/null <<APP
tell application "Terminal"
  activate
  do script "unset MallocStackLogging MallocStackLoggingNoCompact MallocStackLoggingDirectory MallocScribble MallocGuardEdges MallocNanoZone; export FOG_HOME='$FOG'; exec /usr/bin/caffeinate -ims python3 '$TUI' 2> >(grep -v -F MallocStackLogging >&2 || true)"
end tell
APP
EOS
chmod 755 "$DEST/FogRuntime.app/Contents/MacOS/FogRuntime"

# --- Fog Installer ---
make_app "$DEST" "Fog Installer" "pt.calhegasmorais.fog.installer" "FogInstaller"
cat > "$DEST/FogInstaller.app/Contents/MacOS/FogInstaller" <<'EOS'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog/repo"
CMD="$REPO/deploy/mac-fog/fog-bootstrap.py"
if [[ ! -f "$CMD" ]]; then
  mkdir -p "$(dirname "$REPO")"
  git clone --depth 1 https://github.com/StrataMesh-Laboratory/stratamesh-core.git "$REPO" || true
  CMD="$REPO/deploy/mac-fog/fog-bootstrap.py"
fi
osascript >/dev/null <<APP
tell application "Terminal"
  activate
  do script "python3 '$CMD'"
end tell
APP
EOS
chmod 755 "$DEST/FogInstaller.app/Contents/MacOS/FogInstaller"

# Copy templates into the repo tree (git-tracked) as well
REPO_APPS="$HERE/apps"
mkdir -p "$REPO_APPS"
for a in FogStayAwake FogRuntime FogInstaller; do
  rm -rf "$REPO_APPS/${a}.app"
  cp -R "$DEST/${a}.app" "$REPO_APPS/${a}.app"
done

sign_strip() {
  local app="$1"
  xattr -cr "$app" 2>/dev/null || true
  codesign --force --deep --sign - "$app" 2>/dev/null || true
}
for a in FogStayAwake FogRuntime FogInstaller; do
  sign_strip "$DEST/${a}.app"
  sign_strip "$REPO_APPS/${a}.app"
done

# Convenience aliases in repo
rm -rf "$HERE/FogStayAwake.app" "$HERE/FogRuntime.app" "$HERE/FogInstaller.app"
ln -sfn "$DEST/FogStayAwake.app" "$HERE/FogStayAwake.app" 2>/dev/null || true
ln -sfn "$DEST/FogRuntime.app" "$HERE/FogRuntime.app" 2>/dev/null || true
ln -sfn "$DEST/FogInstaller.app" "$HERE/FogInstaller.app" 2>/dev/null || true

echo "installed apps → $DEST"
ls -d "$DEST"/*.app
echo "double-click: Fog Installer.app   then   Fog Stay Awake.app"
