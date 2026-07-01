import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { CloudflareConfig, ZoneConfig } from "../libs/config-validation";

const cfGetRecord = mock();
const cfCreateRecord = mock();
const cfUpdateRecord = mock();
const cfConstructorArgs: Array<[string, string]> = [];

mock.module("../libs/cloudflare-api", () => ({
  default: class {
    constructor(token: string, zoneId: string) {
      cfConstructorArgs.push([token, zoneId]);
    }
    getRecord = cfGetRecord;
    createRecord = cfCreateRecord;
    updateRecord = cfUpdateRecord;
  },
}));

const getCurrentIPv4 = mock();
const getCurrentIPv6 = mock();

mock.module("../libs/public-ip", () => ({
  getCurrentIPv4,
  getCurrentIPv6,
}));

const loggerInfo = mock();
const loggerError = mock();

mock.module("../libs/logger", () => ({
  default: { info: loggerInfo, error: loggerError, log: mock() },
}));

const getConfig = mock();

mock.module("./configuration", () => ({
  default: { getConfig, init: mock(), loadConfig: mock() },
}));

function makeZone(overrides: Partial<ZoneConfig> = {}): ZoneConfig {
  return {
    id: "zone-id",
    type: "A",
    name: "example.com",
    content: "{CURRENT_IPv4}",
    ttl: 300,
    proxied: true,
    ...overrides,
  };
}

function makeCloudflareConfig(overrides: Partial<CloudflareConfig> = {}): CloudflareConfig {
  return {
    token: "some-token",
    updateInterval: 60,
    zone: [makeZone()],
    ...overrides,
  };
}

interface TestableUpdater {
  config: CloudflareConfig[];
  start: () => void;
  init: () => void;
  update: (config: CloudflareConfig) => Promise<void>;
}

async function freshUpdater(): Promise<TestableUpdater> {
  const { default: Updater } = await import(`./updater?t=${Date.now()}-${Math.random()}`);
  return Updater as unknown as TestableUpdater;
}

describe("Updater.init", () => {
  beforeEach(() => {
    getConfig.mockReset();
    loggerInfo.mockReset();
    loggerError.mockReset();
  });

  test("logs an error and stops when no configuration is found", async () => {
    getConfig.mockReturnValue(undefined);
    const updater = await freshUpdater();
    updater.start = mock();

    updater.init();

    expect(loggerError).toHaveBeenCalledWith("No configuration found");
    expect(updater.start).not.toHaveBeenCalled();
  });

  test("skips invalid entries but keeps and starts valid ones", async () => {
    getConfig.mockReturnValue([makeCloudflareConfig(), { not: "valid" }]);
    const updater = await freshUpdater();
    updater.start = mock();

    updater.init();

    expect(updater.config).toEqual([makeCloudflareConfig()]);
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining("Invalid configuration"));
    expect(loggerInfo).toHaveBeenCalledWith("Loaded 1 cloudflare configs");
    expect(updater.start).toHaveBeenCalledTimes(1);
  });
});

describe("Updater.update", () => {
  beforeEach(() => {
    cfGetRecord.mockReset();
    cfCreateRecord.mockReset();
    cfUpdateRecord.mockReset();
    cfConstructorArgs.length = 0;
    getCurrentIPv4.mockReset();
    getCurrentIPv6.mockReset();
    loggerInfo.mockReset();
    loggerError.mockReset();

    getCurrentIPv4.mockResolvedValue("1.2.3.4");
    getCurrentIPv6.mockResolvedValue("::1");
  });

  test("resolves an {ENV_TOKEN:*} placeholder from the environment", async () => {
    process.env.MY_CF_TOKEN = "resolved-token";
    cfGetRecord.mockResolvedValue([]);
    cfCreateRecord.mockResolvedValue({ id: "new" });

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig({ token: "{ENV_TOKEN:MY_CF_TOKEN}" }));

    expect(cfConstructorArgs[0][0]).toBe("resolved-token");
    delete process.env.MY_CF_TOKEN;
  });

  test("logs an error and stops when the placeholder env var is missing", async () => {
    delete process.env.MISSING_CF_TOKEN;

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig({ token: "{ENV_TOKEN:MISSING_CF_TOKEN}" }));

    expect(loggerError).toHaveBeenCalledWith("Environment variable MISSING_CF_TOKEN not found");
    expect(cfGetRecord).not.toHaveBeenCalled();
  });

  test("logs an error and stops when the ip lookup fails", async () => {
    getCurrentIPv4.mockRejectedValue(new Error("network down"));

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining("Unable to fetch ip address"));
    expect(cfGetRecord).not.toHaveBeenCalled();
  });

  test("skips a zone when fetching its records fails", async () => {
    cfGetRecord.mockRejectedValue(new Error("boom"));

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(loggerError).toHaveBeenCalledWith("Unable to get records for zone zone-id");
    expect(cfCreateRecord).not.toHaveBeenCalled();
  });

  test("creates a record when none exist for the zone", async () => {
    cfGetRecord.mockResolvedValue([]);
    cfCreateRecord.mockResolvedValue({ id: "new" });

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(cfCreateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ type: "A", name: "example.com", content: "1.2.3.4" }),
    );
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("Created"));
  });

  test("updates the record when content differs from the current ip", async () => {
    cfGetRecord.mockResolvedValue([
      { id: "record-1", content: "9.9.9.9", ttl: 300, proxied: true },
    ]);
    cfUpdateRecord.mockResolvedValue({ id: "record-1" });

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(cfUpdateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ record_id: "record-1", content: "1.2.3.4" }),
    );
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("updated to"));
  });

  test("updates ttl/proxied when content matches but settings differ", async () => {
    cfGetRecord.mockResolvedValue([
      { id: "record-1", content: "1.2.3.4", ttl: 60, proxied: false },
    ]);
    cfUpdateRecord.mockResolvedValue({ id: "record-1" });

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(cfUpdateRecord).toHaveBeenCalledWith(
      expect.objectContaining({ record_id: "record-1", ttl: 300, proxied: true }),
    );
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("updated proxy status/ttl"));
  });

  test("does nothing when the record is already up to date", async () => {
    cfGetRecord.mockResolvedValue([
      { id: "record-1", content: "1.2.3.4", ttl: 300, proxied: true },
    ]);

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(cfUpdateRecord).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("already up to date"));
  });

  test("logs an error when multiple records are found for a zone", async () => {
    cfGetRecord.mockResolvedValue([
      { id: "record-1", content: "1.2.3.4", ttl: 300, proxied: true },
      { id: "record-2", content: "1.2.3.4", ttl: 300, proxied: true },
    ]);

    const updater = await freshUpdater();
    await updater.update(makeCloudflareConfig());

    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining("Multiple records found"));
    expect(cfUpdateRecord).not.toHaveBeenCalled();
  });
});
