import winston from 'winston';
import { format } from 'date-fns';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for detailed error logging
const errorFormat = errors({ stack: true });

// Custom format for objects and arrays
const objectFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const ts = format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
  let output = `${ts} ${level}: ${message}`;

  // Handle error objects specially
  if (metadata.error) {
    output += `\nError: ${metadata.error.message}`;
    if (metadata.error.stack) {
      output += `\nStack: ${metadata.error.stack}`;
    }
    delete metadata.error;
  }

  // Format remaining metadata
  if (Object.keys(metadata).length > 0) {
    const cleanMetadata = Object.entries(metadata).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'string' && value.length > 500 
        ? value.substring(0, 500) + '...'
        : value;
      return acc;
    }, {});

    output += '\n' + JSON.stringify(cleanMetadata, null, 2);
  }

  return output;
});

// Create custom log levels with colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'gray'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'debug',
  format: combine(
    timestamp(),
    errorFormat,
    colorize(),
    objectFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        objectFormat
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: combine(
        timestamp(),
        errorFormat,
        objectFormat
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/debug.log',
      format: combine(
        timestamp(),
        objectFormat
      )
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});