import Logger from "../libs/logger";
import Configuration from "./configuration";

import CloudflareAPI from "../libs/cloudflare-api";
import { getCurrentIPv4, getCurrentIPv6 } from "../libs/public-ip";
import {
  CloudflareConfig,
  isCloudflareConfig,
  isEnviromentTokenPlaceholder,
  parseEnvironmentTokenPlaceholderName,
} from "../libs/config-validation";

class Updater {
  private readonly config: Array<CloudflareConfig> = [];

  public init(): void {
    const _config = Configuration.getConfig<unknown[]>("UpdaterConfig");
    if (!_config) {
      Logger.error("No configuration found");
      return;
    }

    for (const cloudflareConfig of _config) {
      if (
        !isCloudflareConfig(cloudflareConfig, (envTokenName) =>
          Logger.error(`Environment variable ${envTokenName} not found`),
        )
      ) {
        Logger.error(`Invalid configuration for cloudflare: ${JSON.stringify(cloudflareConfig)}`);
        continue;
      }

      this.config.push(cloudflareConfig);
    }

    Logger.info(`Loaded ${this.config.length} cloudflare configs`);
    this.start();
  }

  public start(): void {
    Logger.info("Starting updater");
    for (const cloudflareConfig of this.config) {
      this.update(cloudflareConfig);
      setInterval(() => this.update(cloudflareConfig), cloudflareConfig.updateInterval * 1000);
    }
  }

  private async update(cloudflareConfig: CloudflareConfig) {
    let token = cloudflareConfig.token;

    // Replace placeholders env with value
    if (isEnviromentTokenPlaceholder(token)) {
      const envTokenName = parseEnvironmentTokenPlaceholderName(token)!;
      if (process.env[envTokenName]) {
        token = process.env[envTokenName]!;
      } else {
        Logger.error(`Environment variable ${envTokenName} not found`);
        return;
      }
    }

    let IPv4, IPv6;
    try {
      IPv4 = await getCurrentIPv4();
      IPv6 = await getCurrentIPv6();
    } catch (err) {
      Logger.error(`Unable to fetch ip address: ${err}`);
      return;
    }

    if (IPv4) Logger.info(`Current IPv4 address: ${IPv4}`);
    if (IPv6) Logger.info(`Current IPv6 address: ${IPv6}`);

    for (const zone of cloudflareConfig.zone) {
      const api = new CloudflareAPI(token, zone.id);
      const records = await api
        .getRecord({
          type: zone.type,
          name: zone.name,
        })
        .catch((err) => {
          Logger.error(`Unable to get records for zone ${zone.id}`);
          return err;
        });

      if (records instanceof Error) {
        continue;
      }

      // No records found, create it
      if (!records || records.length === 0) {
        const newContent = zone.content
          .replaceAll("{CURRENT_IPv4}", IPv4)
          .replaceAll("{CURRENT_IPv6}", IPv6!);

        const result = await api
          .createRecord({
            type: zone.type,
            name: zone.name,
            content: newContent,
            ttl: zone.ttl,
            proxied: zone.proxied,
          })
          .catch((err) => {
            Logger.error(`Unable to create record: ${err.message}`);
            return undefined;
          });

        if (result) Logger.info(`Created [${zone.type}] (${zone.name} -> ${newContent})`);
      }

      // Only 1 matching records found
      else if (records.length === 1) {
        const record = records[0];
        const newContent = zone.content
          .replaceAll("{CURRENT_IPv4}", IPv4)
          .replaceAll("{CURRENT_IPv6}", IPv6!);

        // Check if the ip is the same
        if (record.content !== IPv4 && record.content !== IPv6) {
          const updateResult = await api
            .updateRecord({
              record_id: record.id,
              type: zone.type,
              name: zone.name,
              ttl: zone.ttl,
              content: newContent,
              proxied: zone.proxied,
            })
            .catch((err) => {
              Logger.error(`Unable to update record: ${err.message}`);
              return undefined;
            });

          if (updateResult)
            Logger.info(
              `[${zone.type}] (${zone.name} -> ${record.content}) updated to (${zone.name} -> ${newContent})`,
            );
        } else if (record.ttl !== zone.ttl || record.proxied !== zone.proxied) {
          const updateResult = await api
            .updateRecord({
              record_id: record.id,
              type: zone.type,
              name: zone.name,
              ttl: zone.ttl,
              content: newContent,
              proxied: zone.proxied,
            })
            .catch((err) => {
              Logger.error(`Unable to update record: ${err.message}`);
              return undefined;
            });

          if (updateResult)
            Logger.info(
              `[${zone.type}] (${zone.name} -> ${record.content}) updated proxy status/ttl (TTL: ${record.ttl} -> ${zone.ttl}) (Proxy status: ${record.proxied} -> ${zone.proxied})`,
            );
        } else {
          Logger.info(`[${zone.type}] (${zone.name} -> ${record.content}) already up to date`);
          continue;
        }
      }

      // Many records found
      else if (records.length > 1) {
        Logger.error(
          `Multiple records found for ${zone.type} (${zone.name}) (Multiple records are not supported right now)`,
        );
        continue;
      }
    }
  }
}

export default new Updater();
