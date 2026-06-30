# Cloudflare DDNS Updater

Cloudflare DDNS Updater keeps Cloudflare DNS records pointed at the machine's current public IPv4 and/or IPv6 address.

The container reads:

- Environment variables from Docker, usually via `--env-file .env`.
- DNS update rules from `/home/node/app/configs/UpdaterConfig.json` inside the container.

## Quick Start

Pull the published image:

```sh
docker pull ghcr.io/yuzuzensai/cloudflare-ddns-updater:latest
```

Create `.env` from the example:

```sh
cp .env.example .env
```

Edit `.env` and set your Cloudflare API token:

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

Start it with:

```sh
docker compose up -d
```

## Configuration

`configs/UpdaterConfig.json` is an array of Cloudflare account/token configurations.

Each top-level object uses these fields:

- `token`: Cloudflare API token, or an environment reference like `{ENV_TOKEN:EXAMPLE_SITE_TOKEN}`.
- `updateInterval`: update interval in seconds.
- `zone`: DNS records to manage.

Each `zone` entry uses these fields:

- `id`: Cloudflare zone ID.
- `type`: DNS record type, usually `A` or `AAAA`.
- `name`: DNS record name, for example `example.com` or `home.example.com`.
- `content`: `{CURRENT_IPv4}` for an `A` record or `{CURRENT_IPv6}` for an `AAAA` record.
- `ttl`: Cloudflare TTL. Use `1` for automatic TTL.
- `proxied`: Cloudflare proxy status, `true` or `false`.

Important: keep the JSON property order shown in the examples. The current config validator expects exact key order.

## Cloudflare Zone ID And Token

You need two Cloudflare values before running the updater:

- Zone ID: identifies the Cloudflare zone/domain that contains the DNS records.
- API token: authorizes the updater to read and edit DNS records in that zone.

The Zone ID goes in `configs/UpdaterConfig.json` as `zone[].id`.

The API token should go in `.env`, then `configs/UpdaterConfig.json` references it with `{ENV_TOKEN:VARIABLE_NAME}`. The variable name is up to you. `EXAMPLE_SITE_TOKEN`, `HOME_SITE_TOKEN`, `MY_DOMAIN_TOKEN`, or any other valid environment variable name will work as long as both files use the same name.

### Get Your Zone ID

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Select the domain you want to update.
3. Open the domain overview page.
4. Find `Zone ID` in the right sidebar under `API`.
5. Copy that value into each matching `zone[].id` field in `configs/UpdaterConfig.json`.

Example:

```json
{
  "id": "023e105f4ecef8ad9ca31a8372d0c353",
  "type": "A",
  "name": "home.example.com",
  "content": "{CURRENT_IPv4}",
  "ttl": 1,
  "proxied": false
}
```

### Create an API Token

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Click your profile icon in the top-right corner.
3. Open `My Profile`.
4. Open `API Tokens`.
5. Select `Create Token`.

The easiest option is the built-in template:

1. Find the `Edit zone DNS` template.
2. Select `Use template`.
3. Under `Zone Resources`, select `Include` > `Specific zone` > your domain.
4. Leave the permissions as DNS edit/read permissions.
5. Select `Continue to summary`.
6. Review the token summary.
7. Select `Create Token`.
8. Copy the token immediately. Cloudflare only shows it once.

If you create a custom token instead, use this setup:

1. Select `Create Custom Token`.
2. Give it a clear name, for example `Cloudflare DDNS Updater`.
3. Add these permissions:

- `Zone` > `DNS` > `Edit`
- `Zone` > `Zone` > `Read`

Set the zone resource scope:

1. Under `Zone Resources`, choose `Include`.
2. Choose `Specific zone`.
3. Select the domain this updater will manage.
4. Select `Continue to summary`.
5. Review the token summary.
6. Select `Create Token`.
7. Copy the token immediately. Cloudflare only shows it once.

Do not use your Global API Key. This app only needs a scoped API token with DNS access for the selected zone.

After creating the token, copy it into `.env`. The name before `=` is the environment variable name. You can change it.

```env
EXAMPLE_SITE_TOKEN=your-cloudflare-api-token
```

If you change the variable name in `.env`, update the `token` value in `configs/UpdaterConfig.json` to match it exactly.

Example:

```env
HOME_SITE_TOKEN=your-token
```

```json
"token": "{ENV_TOKEN:HOME_SITE_TOKEN}"
```

Another example with a different name:

```env
MY_DOMAIN_TOKEN=your-token
```

```json
"token": "{ENV_TOKEN:MY_DOMAIN_TOKEN}"
```

Do not include the literal token in `UpdaterConfig.json` unless you intentionally want the secret stored there. Using `{ENV_TOKEN:...}` keeps the token in `.env`, which is ignored by git.

## Notes

- The updater fetches IPv4 from `https://api.ipify.org?format=json`.
- The updater fetches IPv6 from `https://api64.ipify.org/?format=json`.
- If `configs/UpdaterConfig.json` is missing, the app creates one from the bundled example, but you must edit it before real use.
