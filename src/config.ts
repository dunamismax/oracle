import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const validLogLevels = ["debug", "info", "warn", "warning", "error"] as const;
const validLogLevelsSet = new Set<string>(validLogLevels);

const validationSchema = z
  .object({
    discordToken: z.string().min(1, "MTG_DISCORD_TOKEN is required"),
    commandPrefix: z.string(),
    logLevel: z.string(),
    jsonLogging: z.boolean(),
    commandCooldown: z.number().finite(),
  })
  .superRefine((value, context) => {
    if (!validLogLevelsSet.has(value.logLevel)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logLevel"],
        message: `Invalid log level: ${value.logLevel}. Must be one of ${validLogLevels.join(", ")}`,
      });
    }
  });

function getBoolean(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue = false,
): boolean {
  const value = env[key];
  if (value === undefined) {
    return defaultValue;
  }

  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function getFloat(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue = 0,
): number {
  const value = env[key];
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function loadEnvFile(envFile: string): void {
  if (!existsSync(envFile)) {
    return;
  }

  const contents = readFileSync(envFile, "utf8");

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export class BotConfig {
  discordToken: string;
  commandPrefix: string;
  logLevel: string;
  jsonLogging: boolean;
  commandCooldown: number;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.discordToken = env.MTG_DISCORD_TOKEN ?? "";
    this.commandPrefix = env.MTG_COMMAND_PREFIX ?? "!";
    this.logLevel = (env.MTG_LOG_LEVEL ?? env.LOG_LEVEL ?? "info").toLowerCase();
    this.jsonLogging = getBoolean(
      env,
      "MTG_JSON_LOGGING",
      getBoolean(env, "JSON_LOGGING", false),
    );
    this.commandCooldown = getFloat(env, "MTG_COMMAND_COOLDOWN", 2);
  }

  validateConfig(): void {
    const result = validationSchema.safeParse({
      discordToken: this.discordToken,
      commandPrefix: this.commandPrefix,
      logLevel: this.logLevel,
      jsonLogging: this.jsonLogging,
      commandCooldown: this.commandCooldown,
    });

    if (!result.success) {
      throw new Error(result.error.issues[0]?.message ?? "Invalid configuration");
    }
  }
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): BotConfig {
  return new BotConfig(env);
}
