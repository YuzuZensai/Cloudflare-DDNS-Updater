import Logger from "../libs/logger";

import Environment from "./environment";
import Configuration from "./configuration";
import Updater from "./updater";

class App {
  public loadConfig(): void {
    Logger.log("info", "Loading configuration");
    Configuration.init();
  }

  public loadENV(): void {
    Logger.log("info", "Loading environment");
    Environment.init();
  }
  public loadUpdater(): void {
    Logger.log("info", "Loading updater");
    Updater.init();
  }
}

export default new App();
