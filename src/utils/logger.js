const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${level}: ${message}`;
    
    if (data) {
      return `${formattedMessage}\n${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  error(message, data = null) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message, data = null) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(this.formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }
}

export const logger = new Logger();
