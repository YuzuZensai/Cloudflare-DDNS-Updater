export interface ZoneConfig {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export interface CloudflareConfig {
  token: string;
  updateInterval: number;
  zone: Array<ZoneConfig>;
}

export function arraysEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isEnviromentTokenPlaceholder(token: string): boolean {
  return token.startsWith("{ENV_TOKEN:") && token.endsWith("}");
}

export function parseEnvironmentTokenPlaceholderName(token: string): string | null {
  if (!isEnviromentTokenPlaceholder(token)) return null;
  return token.split("{ENV_TOKEN:")[1].slice(0, -1);
}

export function isZoneConfig(object: any): object is ZoneConfig {
  if (!arraysEqual(Object.keys(object), ["id", "type", "name", "content", "ttl", "proxied"]))
    return false;

  return (
    object &&
    object.id &&
    typeof object.id == "string" &&
    object.type &&
    typeof object.type == "string" &&
    object.name &&
    typeof object.name == "string" &&
    object.content &&
    typeof object.content == "string" &&
    object.ttl &&
    typeof object.ttl == "number" &&
    typeof object.proxied == "boolean"
  );
}

export function isCloudflareConfig(
  object: any,
  onMissingEnvToken?: (envTokenName: string) => void,
): object is CloudflareConfig {
  if (!arraysEqual(Object.keys(object), ["token", "updateInterval", "zone"])) return false;

  const res =
    object &&
    object.token &&
    typeof object.token == "string" &&
    object.updateInterval &&
    typeof object.updateInterval == "number";

  for (let zone of object.zone) {
    if (!isZoneConfig(zone)) return false;
  }

  if (!res) return false;

  const token = object.token as string;

  // Process the env token
  if (isEnviromentTokenPlaceholder(token)) {
    const envTokenName = parseEnvironmentTokenPlaceholderName(token)!;
    const envValue = process.env[envTokenName];

    if (!envValue) {
      onMissingEnvToken?.(envTokenName);
      return false;
    }
  }

  return true;
}
