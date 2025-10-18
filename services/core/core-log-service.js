// Core_LogService: Centralized logging utility for the application
export class Core_LogService {

   // All log levels accepted (bitmask values)
   static levels = {
      ALWAYS: 8192,      // Always log
      INFO: 1,           // Informational messages
      DEBUG: 2,          // Debugging messages
      ERROR: 4,          // Error messages
      FATAL: 8,          // Fatal errors
      TIMESTAMP: 16,     // Custom timestamp logs
      ALL: 31            // All log levels
   };

   // Human-readable string for each log level
   static levelString = {
      "1": "INFO",
      "2": "DEBUG",
      "4": "ERROR",
      "8": "FATAL",
      "16": "TIMESTAMP"
   }

   /**
    * Constructor: Sets the default log level and output function.
    * The log level is initialized from the default service and always includes ALWAYS.
    * Output defaults to console.log.
    */
   constructor() {
      this.level = $svc('default').log.level | Core_LogService.levels.ALWAYS;
      this.output = console.log; // Default output is console.log
   }

   /**
    * Set the current log level.
    * @param {number} level - The log level to set (see Core_LogService.levels)
    */
   setLevel(level) {
      this.level = level | Core_LogService.levels.ALWAYS;
   }

   /**
    * Set a custom output function for logs.
    * @param {function} fn - Output function (signature: (msg, ...args) => void)
    */
   setOutput(fn) {
      this.output = typeof fn === 'function' ? fn : console.log;
   }

   /**
    * Generic method to log a message if the log level is enabled.
    * Adds an ISO timestamp and supports logging objects.
    * @param {number} type - Log level/type
    * @param {*} msg - Message or object to log
    */
   pushError(type, msg) {
      if (this.level & type) {
         const time = new Date().toISOString();
         const prefix = `[${Core_LogService.levelString[type] || type}][${time}] :`;
         if (typeof msg === 'object') {
            this.output(prefix, msg);
         } else {
            this.output(`${prefix} ${msg}`);
         }
      }
   }

   /**
    * Log a fatal error message.
    * @param {*} msg - Message or object to log
    */
   fatalError(msg) {
      this.pushError(Core_LogService.levels.FATAL, msg);
   }

   /**
    * Log an error message.
    * @param {*} msg - Message or object to log
    */
   error(msg) {
      this.pushError(Core_LogService.levels.ERROR, msg);
   }

   /**
    * Log a debug message.
    * @param {*} msg - Message or object to log
    */
   debug(msg) {
      this.pushError(Core_LogService.levels.DEBUG, msg);
   }

   /**
    * Log an informational message.
    * @param {*} msg - Message or object to log
    */
   info(msg) {
      this.pushError(Core_LogService.levels.INFO, msg);
   }

   /**
    * Log a message with a custom timestamp (in addition to the ISO timestamp).
    * @param {*} msg - Message or object to log
    */
   timeStamp(msg) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
      const customTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;
      this.pushError(Core_LogService.levels.TIMESTAMP, `${msg} : ${customTime}`);
   }
}