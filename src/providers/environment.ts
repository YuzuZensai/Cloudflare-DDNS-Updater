import * as path from "path";
import * as dotenv from "dotenv";

import Logger from "../libs/logger";

interface EnvironmentVariables {
  NODE_ENV: string | undefined;
}

const requiredENV = ["NODE_ENV"];

class Environment {
  public init(): void {
    dotenv.config({ path: path.resolve(__dirname, "../../.env") });

    for (const param of requiredENV) {
      if (this.isUndefinedOrEmpty(process.env[param]))
        throw new Error(`.env ${param} is undefined`);
    }

    // NODE_ENV Checks
    if (this.get().NODE_ENV !== "production" && this.get().NODE_ENV !== "development")
      throw new Error('.env NODE_ENV must be either "production" or "development"');

    Logger.log("info", `Running in ${process.env.NODE_ENV} environment`);
  }

  public get(): EnvironmentVariables {
    return {
      NODE_ENV: process.env.NODE_ENV,
    };
  }

  private isUndefinedOrEmpty(value: string | undefined): boolean {
    return value === undefined || value === "";
  }
}

export default new Environment();
