# Tailscale on Fog (macOS)

Ops hop for EDGE-GROK to reach `FOG-NODE-PT-CM-001` without opening TCP/22 to the internet.

## Once on the Mac

1. Create an **auth key** (Tailscale admin → Settings → Keys). Prefer tagged `tag:fog`, expiry short.
2. Vault only:

```
umask 077
printf '%s\n' 'tskey-auth-...' > ~/.config/stratamesh/tailscale.authkey
chmod 600 ~/.config/stratamesh/tailscale.authkey
```

3. Run:

```
curl -fsSL -o /tmp/tailscale-fog.sh https://raw.githubusercontent.com/StrataMesh-Laboratory/stratamesh-core/main/deploy/mac-fog/tailscale-fog.sh
zsh /tmp/tailscale-fog.sh
```

Hostname on the tailnet: `fog-cmn-mbpa`. `--ssh` enables Tailscale SSH (not public 22).

Never git the `tskey-auth-` value. Rotate the key after first join if it was reusable.
