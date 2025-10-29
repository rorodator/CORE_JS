import { ajax } from 'rxjs/ajax';
import { map, catchError, of } from 'rxjs';

export class Core_AjaxService {

   constructor() {
   }

   /**
    * Sends a PUT request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    */
   put(url, body) {
      return ajax({
         url: this.mapURL(url),
         method: 'PUT',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => {
            if (response.status >= 200 && response.status < 300) {
               return response.response;
            } else {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
         }),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a POST request with a JSON body and returns the parsed response.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    */
   getJSON(url, body) {
      return ajax({
         url: this.mapURL(url),
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => {
            // Check HTTP status first - CORE handles technical errors
            if (response.status >= 200 && response.status < 300) {
               // HTTP success - return the API response directly
               // The project will handle functional status codes (SUCCESS, TEAM_EXISTS, etc.)
               return response.response;
            } else {
               // HTTP error - CORE handles technical errors
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
         }),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a GET request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   get(url, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         }
      }).pipe(
         map(response => {
            if (response.status >= 200 && response.status < 300) {
               return response.response;
            } else {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
         }),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a DELETE request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   delete(url, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'DELETE',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         }
      }).pipe(
         map(response => {
            if (response.status >= 200 && response.status < 300) {
               return response.response;
            } else {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
         }),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a PATCH request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    * @param {Object} [headers={}] Optional headers.
    */
   patch(url, body, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'PATCH',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => {
            if (response.status >= 200 && response.status < 300) {
               return response.response;
            } else {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
         }),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Handles errors for all AJAX requests.
    * Preserves HTTP status codes and response information.
    * @param {*} error The error object.
    * @returns {Observable} An observable with the enhanced error.
    */
   handleError(error) {
      
      
      // CORE handles technical errors with English messages by default
      // since CORE doesn't know what language system the project uses
      let errorMessage = 'Network error occurred';
      
      if (error.xhr) {
         const status = error.xhr.status;
         const statusText = error.xhr.statusText;
         
         // Generate English error messages for common HTTP errors
         switch (status) {
            case 400:
               errorMessage = 'Bad Request: Invalid data sent to server';
               break;
            case 401:
               errorMessage = 'Unauthorized: Please log in again';
               break;
            case 403:
               errorMessage = 'Forbidden: You do not have permission to perform this action';
               break;
            case 404:
               errorMessage = 'Not Found: The requested resource was not found';
               break;
            case 500:
               errorMessage = 'Internal Server Error: Please try again later';
               break;
            case 503:
               errorMessage = 'Service Unavailable: Server is temporarily unavailable';
               break;
            default:
               errorMessage = `HTTP ${status}: ${statusText}`;
         }
         
         // Show alert with English message (CORE doesn't know project's notification system)
         alert(`CORE Error: ${errorMessage}`);
         
         const enhancedError = {
            ...error,
            status: status,
            statusText: statusText,
            response: error.xhr.response,
            message: errorMessage
         };
         return of(enhancedError);
      }
      
      // Generic error
      alert('CORE Error: Network connection failed');
      return of(error);
   }

   /**
    * Maps or transforms the URL before making the request.
    * Override this method if needed.
    * @param {string} url The original URL.
    * @returns {string} The mapped URL.
    */
   mapURL(url) {
      return url;
   }
}