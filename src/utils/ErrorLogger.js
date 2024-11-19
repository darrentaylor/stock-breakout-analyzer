import winston from 'winston';
import { format } from 'date-fns';
import 'winston-daily-rotate-file';

class ErrorLogger {
  constructor() {
    const { combine, timestamp, printf, errors, colorize } = winston.format;

    // Custom format for error logging
    const errorFormat = printf(({ level, message, timestamp, stack, category, ...metadata }) => {
      const ts = format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
      let output = `${ts} [${level}]${category ? ` [${category}]` : ''}: ${message}`;

      if (stack) {
        output += `\nStack: ${stack}`;
      }

      if (Object.keys(metadata).length > 0) {
        output += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
      }

      return output;
    });

    // Configure transport for error logs
    const errorFileTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: combine(
        timestamp(),
        errors({ stack: true }),
        errorFormat
      )
    });

    // Configure transport for debug logs
    const debugFileTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: combine(
        timestamp(),
        errorFormat
      )
    });

    // Create logger instance
    this.logger = winston.createLogger({
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
      },
      format: combine(
        timestamp(),
        errors({ stack: true }),
        errorFormat
      ),
      transports: [
        new winston.transports.Console({
          format: combine(
            colorize(),
            errorFormat
          )
        }),
        errorFileTransport,
        debugFileTransport
      ],
      exceptionHandlers: [
        new winston.transports.File({ 
          filename: 'logs/exceptions.log',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            errorFormat
          )
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({ 
          filename: 'logs/rejections.log',
          format: combine(
            timestamp(),
            errors({ stack: true }),
            errorFormat
          )
        })
      ]
    });
  }

  logError(error, category = 'GENERAL') {
    this.logger.error({
      message: error.message,
      stack: error.stack,
      category,
      code: error.code,
      metadata: error.metadata
    });
  }

  logWarning(message, category = 'GENERAL', metadata = {}) {
    this.logger.warn({
      message,
      category,
      ...metadata
    });
  }

  logInfo(message, category = 'GENERAL', metadata = {}) {
    this.logger.info({
      message,
      category,
      ...metadata
    });
  }

  logDebug(message, category = 'GENERAL', metadata = {}) {
    this.logger.debug({
      message,
      category,
      ...metadata
    });
  }
}

export const errorLogger = new ErrorLogger();