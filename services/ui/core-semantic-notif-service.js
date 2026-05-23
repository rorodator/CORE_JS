/**
 * Service to display notifications using Semantic UI styles.
 * Creates a fixed container and allows showing info, success, warning, or error messages.
 */
export class Core_SemanticNotifService {
   /**
    * Constructs the notification service and appends the container to the body.
    */
   constructor() {
      this.nbNotifs = 0;
      this.container = this.createContainer();
      document.body.appendChild(this.container);
   }

   /**
    * Creates the notification container element.
    * Can be overridden by subclasses for custom placement or styling.
    * @returns {HTMLElement} The notification container.
    */
   createContainer() {
      let container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.bottom = '10px';
      container.style.right = '10px';
      return container;
   }

   /**
    * Shows a notification in the container.
    * @param {string} message - The message to display.
    * @param {string} [type='info'] - The Semantic UI type ('info', 'success', 'warning', 'error').
    * @param {number} [duration=3000] - Duration in ms before auto-dismiss (0 = persistent).
    */
   showNotif(message, type = 'info', duration = 3000) {
      const notification = document.createElement('div');
      notification.className = `ui ${type} message`;
      notification.style.marginBottom = '10px';

      const closeIcon = document.createElement('i');
      closeIcon.className = 'close icon';

      const header = document.createElement('div');
      header.className = 'header';
      header.style.paddingRight = '15px';
      header.textContent = message;

      notification.appendChild(closeIcon);
      notification.appendChild(header);

      // Add the notification to the container
      this.container.appendChild(notification);

      // Allow manual dismissal
      notification.querySelector('.close.icon').addEventListener('click', () => {
         notification.remove();
      });

      // Auto-dismiss after duration if duration > 0
      if (duration > 0) {
         setTimeout(() => {
            notification.remove();
         }, duration);
      }
   }
}