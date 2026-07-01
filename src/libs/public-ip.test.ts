import { beforeEach, describe, expect, mock, test } from "bun:test";

const axiosGet = mock();

mock.module("axios", () => ({
  default: { get: axiosGet },
}));

const { getCurrentIPv4, getCurrentIPv6 } = await import("./public-ip");

describe("getCurrentIPv4", () => {
  beforeEach(() => axiosGet.mockReset());

  test("returns the ip when a valid IPv4 address is returned", async () => {
    axiosGet.mockResolvedValue({ data: { ip: "1.2.3.4" } });
    expect(await getCurrentIPv4()).toBe("1.2.3.4");
  });

  test("throws when no ip is returned", async () => {
    axiosGet.mockResolvedValue({ data: {} });
    await expect(getCurrentIPv4()).rejects.toThrow("Unable to fetch ip address");
  });

  test("throws when the returned ip is not a valid IPv4 address", async () => {
    axiosGet.mockResolvedValue({ data: { ip: "not-an-ip" } });
    await expect(getCurrentIPv4()).rejects.toThrow("Invalid IP");
  });
});

describe("getCurrentIPv6", () => {
  beforeEach(() => axiosGet.mockReset());

  test("returns the ip when a valid IPv6 address is returned", async () => {
    axiosGet.mockResolvedValue({ data: { ip: "::1" } });
    expect(await getCurrentIPv6()).toBe("::1");
  });

  test("returns null when the returned value is not a valid IPv6 address", async () => {
    axiosGet.mockResolvedValue({ data: { ip: "1.2.3.4" } });
    expect(await getCurrentIPv6()).toBeNull();
  });

  test("throws when no ip is returned", async () => {
    axiosGet.mockResolvedValue({ data: {} });
    await expect(getCurrentIPv6()).rejects.toThrow("Unable to fetch ip address");
  });
});
