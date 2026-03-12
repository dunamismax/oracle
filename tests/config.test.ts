import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfig, loadEnvFile } from "../src/config";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("config", () => {
  it("loadEnvFile sets missing values only", () => {
    const directory = mkdtempSync(join(tmpdir(), "scryfall-bot-"));
    const envFile = join(directory, ".env");

    writeFileSync(
      envFile,
      "MTG_DISCORD_TOKEN=file-token\nMTG_LOG_LEVEL=DEBUG\n",
      "utf8",
    );

    process.env.MTG_DISCORD_TOKEN = "existing-token";

    loadEnvFile(envFile);

    expect(process.env.MTG_DISCORD_TOKEN).toBe("existing-token");
    expect(process.env.MTG_LOG_LEVEL).toBe("DEBUG");

    rmSync(directory, { recursive: true, force: true });
  });

  it("loadConfig reads runtime values", () => {
    process.env.MTG_DISCORD_TOKEN = "token";
    process.env.MTG_COMMAND_PREFIX = "?";
    process.env.MTG_LOG_LEVEL = "WARNING";
    process.env.MTG_JSON_LOGGING = "true";
    process.env.MTG_COMMAND_COOLDOWN = "1.5";

    const config = loadConfig();

    expect(config.discordToken).toBe("token");
    expect(config.commandPrefix).toBe("?");
    expect(config.logLevel).toBe("warning");
    expect(config.jsonLogging).toBe(true);
    expect(config.commandCooldown).toBe(1.5);
  });

  it("validateConfig requires a discord token", () => {
    process.env.MTG_DISCORD_TOKEN = undefined;

    const config = loadConfig();

    expect(() => config.validateConfig()).toThrowError("MTG_DISCORD_TOKEN is required");
  });
});
