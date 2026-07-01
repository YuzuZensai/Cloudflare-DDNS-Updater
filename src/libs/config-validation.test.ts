import { describe, expect, test } from "bun:test";
import {
  arraysEqual,
  isCloudflareConfig,
  isEnviromentTokenPlaceholder,
  isZoneConfig,
  parseEnvironmentTokenPlaceholderName,
} from "./config-validation";

describe("arraysEqual", () => {
  test("returns true for identical arrays", () => {
    expect(arraysEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  test("returns false for different length arrays", () => {
    expect(arraysEqual(["a"], ["a", "b"])).toBe(false);
  });

  test("returns false for different order", () => {
    expect(arraysEqual(["a", "b"], ["b", "a"])).toBe(false);
  });

  test("returns false when either input is nullish", () => {
    expect(arraysEqual(null, ["a"])).toBe(false);
    expect(arraysEqual(["a"], undefined)).toBe(false);
  });
});

describe("isEnviromentTokenPlaceholder", () => {
  test("recognizes a well formed placeholder", () => {
    expect(isEnviromentTokenPlaceholder("{ENV_TOKEN:MY_TOKEN}")).toBe(true);
  });

  test("rejects a plain string", () => {
    expect(isEnviromentTokenPlaceholder("plain-token")).toBe(false);
  });
});

describe("parseEnvironmentTokenPlaceholderName", () => {
  test("extracts the env var name", () => {
    expect(parseEnvironmentTokenPlaceholderName("{ENV_TOKEN:MY_TOKEN}")).toBe("MY_TOKEN");
  });

  test("returns null for a non-placeholder token", () => {
    expect(parseEnvironmentTokenPlaceholderName("plain-token")).toBeNull();
  });
});

describe("isZoneConfig", () => {
  const validZone = {
    id: "zone-id",
    type: "A",
    name: "example.com",
    content: "{CURRENT_IPv4}",
    ttl: 300,
    proxied: true,
  };

  test("accepts a well formed zone config", () => {
    expect(isZoneConfig(validZone)).toBe(true);
  });

  test("rejects a zone config missing a key", () => {
    const { proxied, ...rest } = validZone;
    expect(isZoneConfig(rest)).toBe(false);
  });

  test("rejects a zone config with wrong types", () => {
    expect(isZoneConfig({ ...validZone, ttl: "300" })).toBe(false);
  });
});

describe("isCloudflareConfig", () => {
  const validConfig = {
    token: "some-token",
    updateInterval: 60,
    zone: [
      {
        id: "zone-id",
        type: "A",
        name: "example.com",
        content: "{CURRENT_IPv4}",
        ttl: 300,
        proxied: true,
      },
    ],
  };

  test("accepts a well formed config", () => {
    expect(isCloudflareConfig(validConfig)).toBe(true);
  });

  test("rejects a config with an invalid zone", () => {
    expect(isCloudflareConfig({ ...validConfig, zone: [{ id: "only-id" }] })).toBe(false);
  });

  test("rejects an env token placeholder whose variable is unset", () => {
    delete process.env.MISSING_TOKEN_VAR;
    const onMissing = () => {};
    expect(
      isCloudflareConfig({ ...validConfig, token: "{ENV_TOKEN:MISSING_TOKEN_VAR}" }, onMissing),
    ).toBe(false);
  });

  test("accepts an env token placeholder whose variable is set", () => {
    process.env.SET_TOKEN_VAR = "resolved-value";
    expect(isCloudflareConfig({ ...validConfig, token: "{ENV_TOKEN:SET_TOKEN_VAR}" })).toBe(true);
    delete process.env.SET_TOKEN_VAR;
  });

  test("invokes the onMissingEnvToken callback with the variable name", () => {
    let received: string | undefined;
    isCloudflareConfig({ ...validConfig, token: "{ENV_TOKEN:CALLBACK_VAR}" }, (name) => {
      received = name;
    });
    expect(received).toBe("CALLBACK_VAR");
  });
});
