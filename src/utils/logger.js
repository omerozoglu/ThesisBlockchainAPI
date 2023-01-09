const { format, createLogger, transports } = require("winston");
const { combine, timestamp, label, printf, colorize } = format;
require("winston-daily-rotate-file");

const CATEGORY = "Blockchain API";

const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level} ::  ${message}`;
});

const fileRotateTransport = new transports.DailyRotateFile({
  filename: "./logs/rotate-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const logger = createLogger({
  level: "debug",
  format: combine(label({ label: CATEGORY }), timestamp(), customFormat),
  transports: [
    fileRotateTransport,
    new transports.Console({
      handleExceptions: true,
      format: combine(colorize(), customFormat),
      level: "silly",
    }),
  ],
  exitOnError: false,
  exceptionHandlers: [
    new transports.File({ filename: "./logs/exceptions.log" }),
  ],
});

module.exports = logger;
