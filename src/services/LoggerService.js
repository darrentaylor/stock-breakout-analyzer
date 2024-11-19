export class LoggerService {
    static log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    static error(message, error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`);
        if (error?.stack) {
            console.error(error.stack);
        }
    }
}