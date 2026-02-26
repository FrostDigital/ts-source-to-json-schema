import type { AppConfig, Environment } from "complex-dts";

export interface ServerSetup {
  config: AppConfig;
  env: Environment;
  name: string;
}
