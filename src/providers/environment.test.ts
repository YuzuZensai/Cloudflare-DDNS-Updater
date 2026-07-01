import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("dotenv", () => ({
  config: () => ({}),
}));

describe("Environment", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("throws when NODE_ENV is missing", async () => {
    delete process.env.NODE_ENV;
    const { default: Environment } = await import(`./environment?t=${Date.now()}-1`);
    expect(() => Environment.init()).toThrow(".env NODE_ENV is undefined");
  });

  test("throws when NODE_ENV is an invalid value", async () => {
    process.env.NODE_ENV = "staging";
    const { default: Environment } = await import(`./environment?t=${Date.now()}-2`);
    expect(() => Environment.init()).toThrow(
      '.env NODE_ENV must be either "production" or "development"',
    );
  });

  test("succeeds and exposes NODE_ENV when valid", async () => {
    process.env.NODE_ENV = "development";
    const { default: Environment } = await import(`./environment?t=${Date.now()}-3`);
    Environment.init();
    expect(Environment.get().NODE_ENV).toBe("development");
  });
});
