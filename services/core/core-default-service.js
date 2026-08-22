import { Core_LogService } from "./core-log-service.js";

export class Core_DefaultService {
   constructor() {
      this.log = {
         level: Core_LogService.levels.ALL
      };
      this.lang = {
         api: 'loadLang',
         globalContainer: 'global',
         isActivated: false
      };
      this.router = {
         emptyURL: '/'
      };
   }
}