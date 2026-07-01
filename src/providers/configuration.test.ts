import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

describe("Configuration", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ddns-config-test-"));
    fs.mkdirSync(path.join(tmpDir, "configs_example"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "configs_example", "UpdaterConfig.example.json"),
      JSON.stringify([{ token: "example-token", updateInterval: 60, zone: [] }]),
    );
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("copies the example config and loads it on init", async () => {
    const { default: Configuration } = await import(`./configuration?t=${Date.now()}-1`);

    Configuration.init();

    expect(Configuration.getConfig("UpdaterConfig")).toEqual([
      { token: "example-token", updateInterval: 60, zone: [] },
    ]);
  });

  test("does not overwrite an existing config file", async () => {
    fs.mkdirSync(path.join(tmpDir, "configs"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "configs", "UpdaterConfig.json"),
      JSON.stringify([{ token: "custom-token", updateInterval: 30, zone: [] }]),
    );

    const { default: Configuration } = await import(`./configuration?t=${Date.now()}-2`);
    Configuration.init();

    expect(Configuration.getConfig("UpdaterConfig")).toEqual([
      { token: "custom-token", updateInterval: 30, zone: [] },
    ]);
  });

  test("getConfig with no key returns all loaded configuration data", async () => {
    const { default: Configuration } = await import(`./configuration?t=${Date.now()}-5`);
    Configuration.init();

    expect(Configuration.getConfig()).toEqual({
      UpdaterConfig: [{ token: "example-token", updateInterval: 60, zone: [] }],
    });
  });

  test("getConfig throws for an unknown key", async () => {
    const { default: Configuration } = await import(`./configuration?t=${Date.now()}-3`);
    Configuration.init();

    expect(() => Configuration.getConfig("Unknown")).toThrow("No configuration found for Unknown");
  });

  test("loadConfig throws when the file does not exist", async () => {
    const { default: Configuration } = await import(`./configuration?t=${Date.now()}-4`);

    expect(() => Configuration.loadConfig("Missing.json")).toThrow(
      "Config file Missing.json does not exist",
    );
  });
});
