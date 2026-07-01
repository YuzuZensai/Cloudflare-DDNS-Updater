import axios from "axios";
import validator from "validator";

export async function getCurrentIPv4(): Promise<string> {
  const response = await axios.get("https://api.ipify.org?format=json");

  if (!response.data.ip) throw new Error("Unable to fetch ip address");

  if (!validator.isIP(response.data.ip, 4)) throw new Error("Invalid IP");

  return response.data.ip;
}

export async function getCurrentIPv6(): Promise<string | null> {
  const response = await axios.get("https://api64.ipify.org/?format=json");

  if (!response.data.ip) throw new Error("Unable to fetch ip address");

  if (!validator.isIP(response.data.ip, 6)) return null;

  return response.data.ip;
}
