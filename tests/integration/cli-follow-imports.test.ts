/**
 * Integration tests for CLI with --followImports flag
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// ES module __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("CLI --followImports", () => {
  let tempDir: string;
  let cliPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-follow-imports-test-"));
    // Path to the CLI script (assumes it's been built)
    cliPath = path.resolve(__dirname, "../../dist/cli.js");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function runCli(args: string): { stdout: string; exitCode: number } {
    try {
      const stdout = execSync(`node ${cliPath} ${args}`, {
        encoding: "utf-8",
        cwd: tempDir,
      });
      return { stdout, exitCode: 0 };
    } catch (error: unknown) {
      if (error && typeof error === "object" && "status" in error) {
        const stdout = "stdout" in error ? String(error.stdout) : "";
        const stderr = "stderr" in error ? String(error.stderr) : "";
        return {
          stdout: stdout + stderr, // Combine stdout and stderr for error messages
          exitCode: Number(error.status),
        };
      }
      throw error;
    }
  }

  it("should follow imports with --followImports local (default)", () => {
    // Create pet.ts
    const petPath = path.join(tempDir, "cli-pet.ts");
    fs.writeFileSync(petPath, `
      export interface Pet {
        _id: string;
        name: string;
        species: string;
      }
    `);

    // Create api.ts
    const apiPath = path.join(tempDir, "cli-api.ts");
    fs.writeFileSync(apiPath, `
      import { Pet } from './cli-pet';
      export interface PostPetReq extends Omit<Pet, "_id"> {}
    `);

    const result = runCli(`${apiPath} --followImports local --rootType PostPetReq`);
    expect(result.exitCode).toBe(0);

    const schema = JSON.parse(result.stdout);
    expect(schema.properties).toBeDefined();
    expect(schema.properties.name).toEqual({ type: "string" });
    expect(schema.properties.species).toEqual({ type: "string" });
    expect(schema.properties._id).toBeUndefined();

    // Should have Pet in $defs (PostPetReq is the root, so not in $defs)
    expect(schema.$defs.Pet).toBeDefined();
  });

  it("should not follow imports with --followImports none", () => {
    // Create base.ts
    const basePath = path.join(tempDir, "cli-base.ts");
    fs.writeFileSync(basePath, `
      export interface Base {
        id: string;
      }
    `);

    // Create derived.ts
    const derivedPath = path.join(tempDir, "cli-derived.ts");
    fs.writeFileSync(derivedPath, `
      import { Base } from './cli-base';
      export interface Derived extends Base {
        name: string;
      }
    `);

    const result = runCli(`${derivedPath} --followImports none`);
    expect(result.exitCode).toBe(0);

    const schema = JSON.parse(result.stdout);
    expect(schema.$defs.Derived).toBeDefined();
    expect(schema.$defs.Base).toBeUndefined();
  });

  it("should work with default followImports mode (local)", () => {
    // Create entity.ts
    const entityPath = path.join(tempDir, "cli-entity.ts");
    fs.writeFileSync(entityPath, `
      export interface Entity {
        id: string;
      }
    `);

    // Create user.ts
    const userPath = path.join(tempDir, "cli-user.ts");
    fs.writeFileSync(userPath, `
      import { Entity } from './cli-entity';
      export interface User extends Entity {
        name: string;
      }
    `);

    // Without specifying --followImports, should default to 'local' in CLI
    const result = runCli(`${userPath}`);
    expect(result.exitCode).toBe(0);

    const schema = JSON.parse(result.stdout);
    // Should have both Entity and User (local mode is default)
    expect(schema.$defs.Entity).toBeDefined();
    expect(schema.$defs.User).toBeDefined();
  });

  it("should support --baseDir option", () => {
    // Create subdirectory
    const subDir = path.join(tempDir, "types");
    fs.mkdirSync(subDir, { recursive: true });

    // Create type.ts in subdirectory
    const typePath = path.join(subDir, "type.ts");
    fs.writeFileSync(typePath, `
      export interface MyType {
        value: string;
      }
    `);

    // Create main.ts in temp root that imports from subdirectory
    const mainPath = path.join(tempDir, "cli-main.ts");
    fs.writeFileSync(mainPath, `
      import { MyType } from './types/type';
      export interface Main {
        data: MyType;
      }
    `);

    const result = runCli(`${mainPath} --followImports local --baseDir ${tempDir}`);
    expect(result.exitCode).toBe(0);

    const schema = JSON.parse(result.stdout);
    expect(schema.$defs.MyType).toBeDefined();
    expect(schema.$defs.Main).toBeDefined();
  });

  it("should validate followImports mode", () => {
    const filePath = path.join(tempDir, "cli-validate.ts");
    fs.writeFileSync(filePath, `
      export interface Test {}
    `);

    const result = runCli(`${filePath} --followImports invalid`);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Invalid followImports mode");
  });

  it("should handle missing imports with error", () => {
    const filePath = path.join(tempDir, "cli-missing.ts");
    fs.writeFileSync(filePath, `
      import { Missing } from './does-not-exist';
      export interface Test {}
    `);

    const result = runCli(`${filePath} --followImports local`);
    expect(result.exitCode).toBe(1);
    // Should contain error about missing module
  });

  it("should work with complex multi-file scenario", () => {
    // Create models directory
    const modelsDir = path.join(tempDir, "models");
    fs.mkdirSync(modelsDir, { recursive: true });

    // Create base model
    const basePath = path.join(modelsDir, "base.ts");
    fs.writeFileSync(basePath, `
      export interface BaseModel {
        id: string;
        createdAt: string;
        updatedAt: string;
      }
    `);

    // Create user model
    const userModelPath = path.join(modelsDir, "user.ts");
    fs.writeFileSync(userModelPath, `
      import { BaseModel } from './base';
      export interface User extends BaseModel {
        name: string;
        email: string;
        role: "admin" | "user";
      }
    `);

    // Create API types
    const apiPath = path.join(tempDir, "cli-complex-api.ts");
    fs.writeFileSync(apiPath, `
      import { User } from './models/user';
      export interface CreateUserReq extends Omit<User, "id" | "createdAt" | "updatedAt"> {}
      export interface UpdateUserReq extends Partial<CreateUserReq> {}
    `);

    const result = runCli(`${apiPath} --followImports local`);
    expect(result.exitCode).toBe(0);

    const schema = JSON.parse(result.stdout);
    expect(schema.$defs.BaseModel).toBeDefined();
    expect(schema.$defs.User).toBeDefined();
    expect(schema.$defs.CreateUserReq).toBeDefined();
    expect(schema.$defs.UpdateUserReq).toBeDefined();
  });
});
