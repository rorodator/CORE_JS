import { Core_LogService } from "./core-log-service";

export class Core_DefaultService {
   constructor() {
      this.log = {
         level: Core_LogService.levels.ALL
      }
      this.paginator = {
         nbValidEntries: 5
      };
      this.lang = {
         api: 'loadLang',
         globalContainer: 'global',
         isActivated: false
      };
      this.cart = {
         loadItemsAPI: 'CART/loadItems',
         addItemAPI: 'CART/addItem',
         removeItemAPI: 'CART/removeItem'
      };
      this.router = {
         emptyURL: 'home',
         rootPath: 'http://localhost/'
      };
   }
}