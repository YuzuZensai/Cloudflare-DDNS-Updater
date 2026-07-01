import axios from "axios";

export default class CloudflareAPI {
  private readonly token: string;
  private readonly zoneId: string;

  constructor(token: string, zoneId: string) {
    this.token = token;
    this.zoneId = zoneId;
  }

  public async getRecord({
    name,
    type,
    content,
    proxied,
    page,
  }: {
    name?: string;
    type?: string;
    content?: string;
    proxied?: boolean;
    page?: number;
  }) {
    const response = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`,
      {
        params: {
          name,
          type,
          perPage: 5000,
          content,
          proxied,
          page,
        },
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data.success !== true)
      throw new Error(`Unable to fetch record: ${response.data.errors[0].message}`);

    return response.data.result;
  }

  public async createRecord({
    name,
    type,
    content,
    ttl,
    proxied,
  }: {
    name?: string;
    type?: string;
    content?: string;
    ttl: number;
    proxied?: boolean;
  }) {
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`,
      {
        type,
        name,
        content,
        ttl,
        proxied,
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data.success !== true)
      throw new Error(`Unable to create record: ${response.data.errors[0].message}`);

    return response.data.result;
  }

  public async updateRecord({
    record_id,
    name,
    type,
    content,
    ttl,
    proxied,
  }: {
    record_id: string;
    name?: string;
    type?: string;
    content?: string;
    ttl: number;
    proxied?: boolean;
  }) {
    const response = await axios.put(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records/${record_id}`,
      {
        type,
        name,
        content,
        ttl,
        proxied,
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data.success !== true)
      throw new Error(`Unable to update record: ${response.data.errors[0].message}`);

    return response.data.result;
  }
}
