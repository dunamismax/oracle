import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { loadConfig, loadEnvFile } from "./src/config";

const APP_NAME = "scryfall-discord-bot";
const REMOVED_COMMANDS = new Set(["stop", "restart", "logs", "kill"]);

function loadLocalEnv(): void {
  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

function validateRuntime() {
  const config = loadConfig();
  config.validateConfig();
  return config;
}

function buildRuntimeCommand(): string[] {
  if (process.versions.bun) {
    return [process.execPath, "run", "src/index.ts"];
  }

  return ["bun", "run", "src/index.ts"];
}

function runBot(): number {
  loadLocalEnv();

  try {
    validateRuntime();
  } catch (error) {
    console.error(
      `Configuration error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const command = buildRuntimeCommand();
  const [binary, ...args] = command;
  if (!binary) {
    console.error("Unable to determine a runtime command.");
    return 1;
  }

  console.log(`Launching ${APP_NAME} in the foreground.`);
  console.log("This repo does not supervise background processes.");
  console.log("Use systemd, Docker, or another external supervisor for restarts.");

  const result = spawnSync(binary, args, {
    stdio: "inherit",
  });

  return result.status ?? 1;
}

function checkRuntime(): number {
  loadLocalEnv();

  try {
    const config = validateRuntime();
    console.log("Configuration looks valid.");
    console.log(`Command prefix: ${config.commandPrefix}`);
    console.log(`Log level: ${config.logLevel}`);
    console.log(`Launch command: ${buildRuntimeCommand().join(" ")}`);
    console.log("No built-in stop/restart/status manager is shipped in this repo.");
    return 0;
  } catch (error) {
    console.error(
      `Configuration error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

export function main(argv = process.argv.slice(2)): number {
  const command = (argv[0] ?? "run").toLowerCase();

  if (command === "run" || command === "start") {
    return runBot();
  }

  if (command === "check" || command === "status") {
    return checkRuntime();
  }

  if (REMOVED_COMMANDS.has(command)) {
    console.error(`\`${command}\` was removed from manage-bot.ts.`);
    console.error("Run the bot in the foreground and let a real supervisor manage it.");
    return 2;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Available commands: run, start, check, status");
  return 2;
}

process.exit(main());
