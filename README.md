# Cloudflare DDNS Updater

Keeps Cloudflare DNS records pointed at the machine's current public IPv4 and/or IPv6 address.

The container reads:

- Environment variables from Docker, usually via `--env-file .env`.
- DNS update rules from `/home/node/app/configs/UpdaterConfig.json` inside the container.

## Quick Start

Pull the published image:

```sh
docker pull ghcr.io/yuzuzensai/cloudflare-ddns-updater:latest
```

Create `.env` from the example and set your Cloudflare API token:

```sh
cp .env.example .env
```

```env
NODE_ENV=production
EXAMPLE_SITE_TOKEN=replace-with-cloudflare-api-token
```

Create `configs/UpdaterConfig.json`:

```json
[
  {
    "token": "{ENV_TOKEN:EXAMPLE_SITE_TOKEN}",
    "updateInterval": 60,
    "zone": [
      {
        "id": "cloudflare-zone-id",
        "type": "A",
        "name": "example.com",
        "content": "{CURRENT_IPv4}",
        "ttl": 1,
        "proxied": false
      },
      {
        "id": "cloudflare-zone-id",
        "type": "AAAA",
        "name": "example.com",
        "content": "{CURRENT_IPv6}",
        "ttl": 1,
        "proxied": false
      }
    ]
  }
]
```

Run the container:

```sh
docker run -d \
  --name cloudflare-ddns-updater \
  --restart unless-stopped \
  --env-file .env \
  -v "$(pwd)/configs:/home/node/app/configs" \
  ghcr.io/yuzuzensai/cloudflare-ddns-updater:latest
```

View logs:

```sh
docker logs -f cloudflare-ddns-updater
```

## Docker Compose

```yaml
services:
  cloudflare-ddns-updater:
    image: ghcr.io/yuzuzensai/cloudflare-ddns-updater:latest
    container_name: cloudflare-ddns-updater
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./configs:/home/node/app/configs
```

```sh
docker compose up -d
```

## Configuration

`configs/UpdaterConfig.json` is an array of Cloudflare account/token configurations.

Each top-level object:

| Field            | Description                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- |
| `token`          | Cloudflare API token, or an environment reference like `{ENV_TOKEN:EXAMPLE_SITE_TOKEN}` |
| `updateInterval` | Update interval in seconds                                                              |
| `zone`           | DNS records to manage                                                                   |

Each `zone` entry:

| Field     | Description                                                               |
| --------- | ------------------------------------------------------------------------- |
| `id`      | Cloudflare zone ID                                                        |
| `type`    | DNS record type, usually `A` or `AAAA`                                    |
| `name`    | DNS record name, e.g. `example.com` or `home.example.com`                 |
| `content` | `{CURRENT_IPv4}` for an `A` record, `{CURRENT_IPv6}` for an `AAAA` record |
| `ttl`     | Cloudflare TTL. Use `1` for automatic                                     |
| `proxied` | Cloudflare proxy status, `true` or `false`                                |

## Cloudflare Zone ID and API Token

**Zone ID** — In the [Cloudflare dashboard](https://dash.cloudflare.com/), select the domain, open its overview page, and copy `Zone ID` from the `API` section of the right sidebar into `zone[].id`.

**API token** — In the dashboard, go to your profile icon → `My Profile` → `API Tokens` → `Create Token`. Use the built-in `Edit zone DNS` template (recommended) or a custom token with `Zone > DNS > Edit` and `Zone > Zone > Read` permissions. Either way, scope `Zone Resources` to `Include` → `Specific zone` → your domain, then create and copy the token — Cloudflare only shows it once. Don't use your Global API Key; the updater only needs a scoped token for the zones it manages.

Put the token in `.env` under any variable name you like, then reference that same name from `UpdaterConfig.json`:

```env
HOME_SITE_TOKEN=your-cloudflare-api-token
```

```json
"token": "{ENV_TOKEN:HOME_SITE_TOKEN}"
```

Avoid writing the literal token directly into `UpdaterConfig.json` — `{ENV_TOKEN:...}` keeps the secret in `.env`, which is gitignored.

## Development

```sh
bun install
bun run dev     # run with --watch
bun run check   # typecheck + format + lint + test
```

## Notes

- IPv4 is looked up via `https://api.ipify.org?format=json`, IPv6 via `https://api64.ipify.org/?format=json`.
- If `configs/UpdaterConfig.json` is missing, the app creates one from the bundled example — edit it before real use.
