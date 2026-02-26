import { toJsonSchema, parseDeclarations } from "../../src/index.js";

describe("declare keyword support", () => {
  it("should parse declare interface", () => {
    const source = `
      declare interface Config {
        port: number;
        host: string;
      }
    `;
    const schema = toJsonSchema(source, { rootType: "Config" });
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("port");
    expect(schema.properties).toHaveProperty("host");
  });

  it("should parse export declare interface", () => {
    const source = `
      export declare interface Config {
        port: number;
        host: string;
      }
    `;
    const schema = toJsonSchema(source, { rootType: "Config" });
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("port");
  });

  it("should parse declare type alias", () => {
    const source = `
      declare type Status = "active" | "inactive";
    `;
    const schema = toJsonSchema(source, { rootType: "Status" });
    expect(schema.enum).toEqual(["active", "inactive"]);
  });

  it("should parse declare enum", () => {
    const source = `
      declare enum Color {
        Red = "red",
        Green = "green",
        Blue = "blue"
      }
    `;
    const schema = toJsonSchema(source, { rootType: "Color" });
    expect(schema.enum).toEqual(["red", "green", "blue"]);
  });

  it("should skip declare function", () => {
    const source = `
      declare function createApp(): void;
      interface Config {
        port: number;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("Config");
  });

  it("should skip declare const/var/let", () => {
    const source = `
      declare const VERSION: string;
      declare var globalState: any;
      declare let counter: number;
      interface Config {
        port: number;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("Config");
  });

  it("should skip declare class", () => {
    const source = `
      declare class InternalService {
        start(): void;
        stop(): void;
      }
      interface Config {
        port: number;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("Config");
  });

  it("should skip declare namespace", () => {
    const source = `
      declare namespace Utils {
        function format(s: string): string;
      }
      interface Config {
        port: number;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("Config");
  });

  it("should skip declare module", () => {
    const source = `
      declare module "express" {
        interface Request {
          body: any;
        }
      }
      interface Config {
        port: number;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(1);
    expect(decls[0].name).toBe("Config");
  });

  it("should handle complex .d.ts file with mixed declarations", () => {
    const source = `
      declare function createApp(): void;
      declare const VERSION: string;
      declare var globalState: any;

      export declare interface AppConfig {
        port: number;
        host: string;
        debug?: boolean;
      }

      export declare type Environment = "development" | "production" | "test";

      export declare enum LogLevel {
        DEBUG = "debug",
        INFO = "info",
        WARN = "warn",
        ERROR = "error"
      }

      declare class InternalService {
        start(): void;
        stop(): void;
      }

      declare namespace Utils {
        function format(s: string): string;
      }
    `;
    const decls = parseDeclarations(source);
    expect(decls).toHaveLength(3);
    expect(decls.map(d => d.name).sort()).toEqual(["AppConfig", "Environment", "LogLevel"]);
  });
});
