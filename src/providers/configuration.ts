import fs from "fs";
import path from "path";

const ConfigurationData: Record<string, unknown> = {};

function configDir(): string {
  return path.join(process.cwd(), "configs");
}

function configExampleDir(): string {
  return path.join(process.cwd(), "configs_example");
}

class Configuration {
  public init(): void {
    const dir = configDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    this.copyExampleIfNotExists("UpdaterConfig.json");

    this.loadConfig("UpdaterConfig.json");
  }

  public loadConfig(configFileName: string): void {
    const filePath = path.join(configDir(), configFileName);
    if (!fs.existsSync(filePath)) throw new Error(`Config file ${configFileName} does not exist`);

    const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    ConfigurationData[configFileName.replace(/\.[^/.]+$/, "")] = config;
  }

  public getConfig<T = unknown>(key?: string): T {
    if (!key) return ConfigurationData as T;

    if (ConfigurationData[key]) return ConfigurationData[key] as T;
    throw new Error(`No configuration found for ${key}`);
  }

  private copyExampleIfNotExists(file: string): void {
    const target = path.join(configDir(), file);
    if (!fs.existsSync(target)) {
      const example = path.join(configExampleDir(), file.replace(".json", ".example.json"));
      fs.copyFileSync(example, target);
    }
  }
}

export default new Configuration();
