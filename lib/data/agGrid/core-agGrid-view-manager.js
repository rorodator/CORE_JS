import { Core_ViewManager } from "../core-view-manager";

export class Core_AgGridViewManager extends Core_ViewManager {
   constructor(params) {
      super(params);
   }

   /**
   * This will be mainly used by AGGrid running as a server-side driven grid
   */
   getRows(gridParams) {
      // We need to work on a copy
      let toReturn = [...this.view];

      // Avoid returning data above the top
      const lastRow = Math.min(gridParams.endRow, this.data.length);

      gridParams.successCallback(
         toReturn.splice(gridParams.startRow, lastRow),
         this.data.length);
   }
}