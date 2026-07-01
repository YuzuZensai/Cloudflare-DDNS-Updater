import { afterEach, describe, expect, test } from "bun:test";
import { level } from "./logger";

describe("level", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("returns debug in development", () => {
    process.env.NODE_ENV = "development";
    expect(level()).toBe("debug");
  });

  test("returns info in production", () => {
    process.env.NODE_ENV = "production";
    expect(level()).toBe("info");
  });

  test("defaults to development (debug) when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    expect(level()).toBe("debug");
  });
});
