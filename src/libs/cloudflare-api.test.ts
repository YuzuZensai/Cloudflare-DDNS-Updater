import { beforeEach, describe, expect, mock, test } from "bun:test";

const axiosGet = mock();
const axiosPost = mock();
const axiosPut = mock();

mock.module("axios", () => ({
  default: {
    get: axiosGet,
    post: axiosPost,
    put: axiosPut,
  },
}));

const { default: CloudflareAPI } = await import("./cloudflare-api");

describe("CloudflareAPI", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    axiosPut.mockReset();
  });

  test("getRecord returns the result on success", async () => {
    axiosGet.mockResolvedValue({ data: { success: true, result: [{ id: "record-1" }] } });

    const api = new CloudflareAPI("token", "zone-id");
    const result = await api.getRecord({ type: "A", name: "example.com" });

    expect(result).toEqual([{ id: "record-1" }]);
    expect(axiosGet).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  test("getRecord throws when the API reports failure", async () => {
    axiosGet.mockResolvedValue({ data: { success: false, errors: [{ message: "bad request" }] } });

    const api = new CloudflareAPI("token", "zone-id");
    await expect(api.getRecord({})).rejects.toThrow("Unable to fetch record: bad request");
  });

  test("createRecord posts the record payload and returns the result", async () => {
    axiosPost.mockResolvedValue({ data: { success: true, result: { id: "new-record" } } });

    const api = new CloudflareAPI("token", "zone-id");
    const result = await api.createRecord({
      type: "A",
      name: "example.com",
      content: "1.2.3.4",
      ttl: 300,
      proxied: false,
    });

    expect(result).toEqual({ id: "new-record" });
    expect(axiosPost).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records",
      expect.objectContaining({ type: "A", name: "example.com", content: "1.2.3.4" }),
      expect.anything(),
    );
  });

  test("createRecord throws when the API reports failure", async () => {
    axiosPost.mockResolvedValue({ data: { success: false, errors: [{ message: "nope" }] } });

    const api = new CloudflareAPI("token", "zone-id");
    await expect(api.createRecord({ ttl: 300 })).rejects.toThrow("Unable to create record: nope");
  });

  test("updateRecord puts the record payload and returns the result", async () => {
    axiosPut.mockResolvedValue({ data: { success: true, result: { id: "record-1" } } });

    const api = new CloudflareAPI("token", "zone-id");
    const result = await api.updateRecord({
      record_id: "record-1",
      type: "A",
      name: "example.com",
      content: "1.2.3.4",
      ttl: 300,
      proxied: false,
    });

    expect(result).toEqual({ id: "record-1" });
    expect(axiosPut).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records/record-1",
      expect.objectContaining({ type: "A", name: "example.com" }),
      expect.anything(),
    );
  });

  test("updateRecord throws when the API reports failure", async () => {
    axiosPut.mockResolvedValue({ data: { success: false, errors: [{ message: "denied" }] } });

    const api = new CloudflareAPI("token", "zone-id");
    await expect(api.updateRecord({ record_id: "record-1", ttl: 300 })).rejects.toThrow(
      "Unable to update record: denied",
    );
  });
});
