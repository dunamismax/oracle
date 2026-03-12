type LogLevelName = "debug" | "info" | "warn" | "warning" | "error";

type LogContextValue = boolean | number | string | null | undefined;
type LogContext = Record<string, LogContextValue>;

const levelPriority: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  warning: 30,
  error: 40,
};

let configuredLevel = levelPriority.info;
let jsonLogging = false;

function normalizeLevel(level: string): LogLevelName {
  const lowerLevel = level.toLowerCase();
  if (lowerLevel === "debug") {
    return "debug";
  }
  if (lowerLevel === "warn" || lowerLevel === "warning") {
    return "warning";
  }
  if (lowerLevel === "error") {
    return "error";
  }
  return "info";
}

function shouldLog(level: LogLevelName): boolean {
  return levelPriority[level] >= configuredLevel;
}

function formatContext(context: LogContext): string {
  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" ");
}

function writeLog(
  level: LogLevelName,
  component: string,
  message: string,
  context: LogContext,
): void {
  if (!shouldLog(level)) {
    return;
  }

  if (jsonLogging) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      logger: component,
      message,
      ...context,
    };
    console.log(JSON.stringify(payload));
    return;
  }

  const contextText = formatContext(context);
  const line = contextText
    ? `${new Date().toISOString()} [${level.toUpperCase()}] [${component}] ${message} ${contextText}`
    : `${new Date().toISOString()} [${level.toUpperCase()}] [${component}] ${message}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warning" || level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export class Logger {
  constructor(private readonly component = "bot") {}

  debug(message: string, context: LogContext = {}): void {
    writeLog("debug", this.component, message, context);
  }

  info(message: string, context: LogContext = {}): void {
    writeLog("info", this.component, message, context);
  }

  warning(message: string, context: LogContext = {}): void {
    writeLog("warning", this.component, message, context);
  }

  error(message: string, context: LogContext = {}): void {
    writeLog("error", this.component, message, context);
  }
}

export function initializeLogger(level = "info", useJsonFormat = false): void {
  const normalizedLevel = normalizeLevel(level);
  configuredLevel = levelPriority[normalizedLevel];
  jsonLogging = useJsonFormat;
}

export function withComponent(component: string): Logger {
  return new Logger(component);
}
