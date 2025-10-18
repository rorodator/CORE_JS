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
            // Always return the response, let the caller decide how to handle it
            return {
               data: response.response,
               status: response.status,
               statusText: response.statusText
            };
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
            // Always return the response, let the caller decide how to handle it
            // This allows functional errors (like 409 for duplicate names) to be handled properly
            return {
               data: response.response,
               status: response.status,
               statusText: response.statusText
            };
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
            // Always return the response, let the caller decide how to handle it
            return {
               data: response.response,
               status: response.status,
               statusText: response.statusText
            };
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
            // Always return the response, let the caller decide how to handle it
            return {
               data: response.response,
               status: response.status,
               statusText: response.statusText
            };
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
            // Always return the response, let the caller decide how to handle it
            return {
               data: response.response,
               status: response.status,
               statusText: response.statusText
            };
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
      console.log(error);
      
      // Preserve HTTP status information from XHR
      if (error.xhr) {
         const enhancedError = {
            ...error,
            status: error.xhr.status,
            statusText: error.xhr.statusText,
            response: error.xhr.response,
            message: error.message || `HTTP ${error.xhr.status}: ${error.xhr.statusText}`
         };
         return of(enhancedError);
      }
      
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