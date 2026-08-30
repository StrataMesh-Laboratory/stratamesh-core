# Fog Mac launcher v7 — installer + Apple apps

Three Finder apps (ad-hoc signed, no Xcode):

| App | Bundle id | Does |
|---|---|---|
| **Fog Installer** | `pt.calhegasmorais.fog.installer` | git pull, node LaunchAgents, stay-awake agent, copies apps → Applications |
| **Fog Stay Awake** | `pt.calhegasmorais.fog.stayawake` | `caffeinate -ims` + 2 min wake kick + runtime UI |
| **Fog Runtime** | `pt.calhegasmorais.fog.runtime` | TUI only (already under caffeinate) |

After install they live in `/Applications/StrataMesh/` (else `~/Applications/StrataMesh/`).

Templates in git: `deploy/mac-fog/apps/*.app`. Rebuild: `bash deploy/mac-fog/build-apps.sh`.

**Stay-awake:** idle sleep held while logged in. True sleep still halts the CPU. Lid + battery will sleep. On charger, lid-closed:

```
sudo pmset -c disablesleep 1
```

Public `fog.calhegasmorais.pt` rides **macbook-server**. Do **not** load `pt.calhegasmorais.tunnel`. Do **not** kill macbook-server cloudflared.

## First install

Double-click `deploy/mac-fog/apps/FogInstaller.app` (or `install-apps.command`). Allow Terminal + Automation if macOS asks. Then double-click **Fog Stay Awake**.

From Terminal:

```
cd ~/StrataMesh/fog/repo
git pull --ff-only
xattr -cr deploy/mac-fog/apps
bash deploy/mac-fog/install-apps.command
open /Applications/StrataMesh
```

TUI keys: `q` quit · `s` stop · `b` reboot · `g` git pull+reboot · `r` refresh. Line `awake caffeinate` = assertion held.

LAB n=2 · `mesh_member=true` · `f_max=0`.
