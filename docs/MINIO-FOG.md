# MinIO — Fog complement to R2

S3-compatible object store on the Mac. Not public origin. Localhost bind; Tailscale if you publish 9000.

Vault (`0600`):

```
~/.config/stratamesh/minio.user    # default minio
~/.config/stratamesh/minio.pass
```

```
umask 077
echo minio > ~/.config/stratamesh/minio.user
openssl rand -base64 18 > ~/.config/stratamesh/minio.pass
chmod 600 ~/.config/stratamesh/minio.pass
zsh deploy/mac-fog/minio-up.sh
```

Buckets to create in the console (`:9001`): `cmn-html`, `cmn-strata` (HEAD artifacts / objects that used to sit on R2).

STASIS on CF R2/KV → read/write these buckets from Python/Node. Pages HTML stays Pages until Caddy points at `cmn-html`.
