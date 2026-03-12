import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { ScryfallBot } from "./bot";
import type { BotConfig } from "./config";
import { loadConfig, loadEnvFile } from "./config";
import { initializeLogger, withComponent } from "./logger";

const VERSION = "2.0.0";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function main(): Promise<void> {
  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }

  let config: BotConfig;
  try {
    config = loadConfig();
    config.validateConfig();
  } catch (error) {
    console.error(`Invalid configuration: ${formatError(error)}`);
    process.exitCode = 1;
    return;
  }

  initializeLogger(config.logLevel, config.jsonLogging);
  const logger = withComponent("main");

  logger.info("Starting bot", {
    app: "scryfall-discord-bot",
    version: VERSION,
  });

  const bot = new ScryfallBot(config);
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("Received shutdown signal", { signal });
    await bot.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    await bot.start(config.discordToken);
  } catch (error) {
    logger.error("Failed to start bot", { error: formatError(error) });
    await bot.close();
    process.exit(1);
  }
}

void main();
