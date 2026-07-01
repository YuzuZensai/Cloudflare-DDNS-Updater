import { describe, expect, test } from "bun:test";
import {
  hasExactKeys,
  isCloudflareConfig,
  isEnviromentTokenPlaceholder,
  isZoneConfig,
  parseEnvironmentTokenPlaceholderName,
} from "./config-validation";

describe("hasExactKeys", () => {
  test("returns true when the object has exactly the given keys", () => {
    expect(hasExactKeys({ a: 1, b: 2 }, ["a", "b"])).toBe(true);
  });

  test("is order independent", () => {
    expect(hasExactKeys({ b: 2, a: 1 }, ["a", "b"])).toBe(true);
  });

  test("returns false when a key is missing", () => {
    expect(hasExactKeys({ a: 1 }, ["a", "b"])).toBe(false);
  });

  test("returns false when there is an extra key", () => {
    expect(hasExactKeys({ a: 1, b: 2, c: 3 }, ["a", "b"])).toBe(false);
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
    const rest: Partial<typeof validZone> = { ...validZone };
    delete rest.proxied;
    expect(isZoneConfig(rest)).toBe(false);
  });

  test("rejects a zone config with wrong types", () => {
    expect(isZoneConfig({ ...validZone, ttl: "300" })).toBe(false);
  });

  test("rejects null and non-object input instead of throwing", () => {
    expect(isZoneConfig(null)).toBe(false);
    expect(isZoneConfig("not-an-object")).toBe(false);
  });

  test("accepts a zone config whose keys are in a different order", () => {
    const { proxied, ttl, ...rest } = validZone;
    expect(isZoneConfig({ ...rest, proxied, ttl })).toBe(true);
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

  test("rejects a config with a null zone entry instead of throwing", () => {
    expect(isCloudflareConfig({ ...validConfig, zone: [null] })).toBe(false);
  });

  test("rejects a config whose zone field is not an array instead of throwing", () => {
    expect(isCloudflareConfig({ ...validConfig, zone: "not-an-array" })).toBe(false);
  });

  test("rejects null and non-object input instead of throwing", () => {
    expect(isCloudflareConfig(null)).toBe(false);
    expect(isCloudflareConfig("not-an-object")).toBe(false);
  });

  test("accepts a config whose top-level keys are in a different order", () => {
    const { zone, ...rest } = validConfig;
    expect(isCloudflareConfig({ zone, ...rest })).toBe(true);
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
