#!/bin/bash
# Pin StrataMesh Lab favicon on the Fog TUI secretary launcher.
# Uses frontend/assets/icon-512.png (Casa / Lab shield). No brew. No tunnel touch.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
FOG="${STRATAMESH_HOME:-$HOME/StrataMesh}/fog"
REPO="$FOG/repo"
ICON="$REPO/frontend/assets/icon-512.png"
[[ -f "$ICON" ]] || ICON="$REPO/frontend/assets/icon-192.png"
[[ -f "$ICON" ]] || ICON="$REPO/frontend/assets/favicon-48.png"
[[ -f "$ICON" ]] || { echo "lab favicon missing — git fetch the repo"; exit 1; }

DEST_APP="$HOME/Applications/StrataMesh/Fog TUI.app"
DESK="$HOME/Desktop/Fog TUI.command"
CMD="$FOG/bin/FogRuntime.command"
mkdir -p "$FOG/bin" "$HOME/Applications/StrataMesh" "$FOG/data/icon"

cp -f "$REPO/deploy/mac-fog/FogRuntime.command" "$CMD"
chmod 755 "$CMD"
ln -sf "$CMD" "$DESK"

# .app wrapper so Dock can show a real icns (plain .command stays a document)
APP="$DEST_APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cat > "$APP/Contents/MacOS/FogTUI" <<EOF
#!/bin/bash
exec /bin/bash "$HOME/StrataMesh/fog/bin/FogRuntime.command"
EOF
chmod 755 "$APP/Contents/MacOS/FogTUI"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Fog TUI</string>
  <key>CFBundleDisplayName</key><string>Fog TUI</string>
  <key>CFBundleIdentifier</key><string>pt.calhegasmorais.fog.tui</string>
  <key>CFBundleExecutable</key><string>FogTUI</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleShortVersionString</key><string>0.3.2</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PLIST

ICONSET="$FOG/data/icon/AppIcon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
sips -z 16 16   "$ICON" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32   "$ICON" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32   "$ICON" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64   "$ICON" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$ICON" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$ICON" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$ICON" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$ICON" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$ICON" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$ICON" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
cp -f "$APP/Contents/Resources/AppIcon.icns" "$FOG/data/icon/AppIcon.icns"

# Finder / Dock custom icon on the .command too
osascript - "$ICON" "$CMD" "$DESK" <<'APP'
on run argv
  set imgPath to item 1 of argv
  set cmdPath to item 2 of argv
  set deskPath to item 3 of argv
  tell application "Finder"
    set imgFile to POSIX file imgPath as alias
    try
      set cmdFile to POSIX file cmdPath as alias
      set desktopFile to POSIX file deskPath as alias
    end try
  end tell
end run
APP

osascript - "$ICON" "$CMD" <<'APP'
on run argv
  use framework "AppKit"
  use framework "Foundation"
  set img to current application's NSImage's alloc()'s initWithContentsOfFile:(item 1 of argv)
  set ws to current application's NSWorkspace's sharedWorkspace()
  ws's setIcon:img forFile:(item 2 of argv) options:0
end run
APP

osascript - "$ICON" "$DESK" <<'APP'
on run argv
  use framework "AppKit"
  use framework "Foundation"
  set img to current application's NSImage's alloc()'s initWithContentsOfFile:(item 1 of argv)
  current application's NSWorkspace's sharedWorkspace()'s setIcon:img forFile:(item 2 of argv) options:0
end run
APP

xattr -cr "$APP" "$CMD" "$DESK" 2>/dev/null || true
/usr/bin/codesign --force --deep -s - "$APP" 2>/dev/null || true

echo "icon: $ICON"
echo "app:  $APP"
echo "desk: $DESK"
open -R "$APP"
