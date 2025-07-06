/* eslint-env browser */
/* @flow */
import { connecting, open, closed, error, message } from "./actions";
import { createWebsocket } from "./websocket";

// Action types to be dispatched by the user
export const WEBSOCKET_CONNECT = "WEBSOCKET:CONNECT";
export const WEBSOCKET_DISCONNECT = "WEBSOCKET:DISCONNECT";
export const WEBSOCKET_SEND_TEXT = "WEBSOCKET:SEND_TEXT";
export const WEBSOCKET_SEND_BINARY = "WEBSOCKET:SEND_BINARY";
export const WEBSOCKET_SIMULATE_ERROR = "WEBSOCKET:SIMULATE_ERROR";
// Action types dispatched by the WebSocket implementation
export const WEBSOCKET_CONNECTING = "WEBSOCKET:CONNECTING";
export const WEBSOCKET_OPEN = "WEBSOCKET:OPEN";
export const WEBSOCKET_ERROR = "WEBSOCKET:ERROR";
export const WEBSOCKET_CLOSED = "WEBSOCKET:CLOSED";
export const WEBSOCKET_MESSAGE = "WEBSOCKET:MESSAGE";

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

const createMiddleware = () => {
  // Hold a reference to the WebSocket instance in use.
  //let websocket: ?WebSocket;
  let websockets = [];
  // Keep track of reconnection timeouts and counts
  let reconnectTimeouts = new Map();
  let reconnectCounts = new Map();

  const getPurposeFromUrl = (url) => {
    if (!url) return "";
    // Extracts the path from a WebSocket URL, e.g., /media/user from ws://...
    const match = url.match(/^wss?:\/\/[^/]+(\/[^?]*)/);
    return match ? match[1] : "";
  };

  /**
   * A function to create the WebSocket object and attach the standard callbacks
   */
  const initialize = ({ dispatch }, config) => {
    // Instantiate the websocket.
    const websocket = createWebsocket(config);
    // Web browsers define URL
    // But on devices it is not defined for some reason
    if (websocket.url === undefined) websocket.url = config.url;

    // Function will dispatch actions returned from action creators.
    const dispatchAction = (actionCreator) => (event) => {
      dispatch(actionCreator(event));
    };

    // On Opening socket
    websocket.onopen = dispatchAction(open);
    // On receiving message
    websocket.onmessage = dispatchAction(message);
    // On Closing socket
    websocket.onclose = (event) => {
      dispatch(closed(event));

      // If our website was removed from list, do not attempt to reconnect
      if (!websockets.includes(websocket)) return;

      // Check if we have an active connection for the same purpose (e.g. message or media).
      // This allows different services to reconnect independently.
      const purpose = getPurposeFromUrl(websocket.url);
      const hasActiveConnectionForSamePurpose = websockets.some(
        (ws) =>
          ws !== websocket &&
          getPurposeFromUrl(ws.url) === purpose &&
          ws.readyState === 1
      );

      if (hasActiveConnectionForSamePurpose) {
        console.log(
          `Another active connection for ${purpose} exists. Not attempting reconnection to ${websocket.url}`
        );
        return;
      }

      const host = websocket.url.split("&token")[0];
      const currentCount = reconnectCounts.get(host) || 0;

      if ((event.code && event.code > 1000) || event.message) {
        console.log(
          `WebSocket closed abnormally for ${websocket.url}:`,
          `\n- Code: ${event.code || "none"}`,
          `\n- Reason: ${event.reason || "none"}`,
          `\n- Message: ${event.message || "none"}`,
          `\n- Current reconnection attempts: ${currentCount}`
        );

        if (currentCount >= MAX_RECONNECT_ATTEMPTS) {
          console.warn(
            `Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${host}. Giving up.`
          );
          return;
        }

        reconnect(websocket, dispatch, config);
      } else {
        console.log(
          `WebSocket closed normally for ${websocket.url}`,
          `\n- Code: ${event.code || "none"}`,
          `\n- Reason: ${event.reason || "none"}`
        );
        websockets = websockets.filter((ws) => ws !== websocket);
      }
    };
    // On socket error
    websocket.onerror = (event) => {
      dispatch(error(event));
      console.error("WebSocket error observed:", event);
    };

    // An optimistic callback assignment for WebSocket objects that support this
    websocket.onconnecting = (event) => {
      dispatch(connecting(event, websocket));
    };

    websockets.push(websocket);
  };

  const reconnect = (websocket, dispatch, config) => {
    const host = websocket.url.split("&token")[0];
    const currentCount = reconnectCounts.get(host) || 0;
    const nextCount = currentCount + 1;

    // Check if next attempt would exceed max attempts
    if (nextCount > MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${host}`
      );
      return;
    }

    // Double check for any active connections for the same purpose again for safety
    const purpose = getPurposeFromUrl(websocket.url);
    const hasActiveConnectionForSamePurpose = websockets.some(
      (ws) =>
        ws !== websocket &&
        getPurposeFromUrl(ws.url) === purpose &&
        ws.readyState === 1
    );
    if (hasActiveConnectionForSamePurpose) {
      console.log(
        `Another active connection for ${purpose} exists. Not attempting reconnection to ${websocket.url}`
      );
      return;
    }

    reconnectCounts.set(host, nextCount);

    // Calculate delay with exponential backoff and jitter
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, currentCount),
      MAX_RECONNECT_DELAY
    );
    // Add some random jitter to prevent thundering herd
    const jitteredDelay = delay * (0.5 + Math.random());

    console.log(
      `Scheduling reconnection attempt ${
        currentCount + 1
      }/${MAX_RECONNECT_ATTEMPTS} for ${websocket.url}:`,
      `\n- Base delay: ${delay}ms`,
      `\n- With jitter: ${jitteredDelay}ms`
    );

    // Clear any existing timeout for this host
    if (reconnectTimeouts.has(host)) {
      clearTimeout(reconnectTimeouts.get(host));
    }

    // Store new timeout
    const timeoutId = setTimeout(function () {
      console.log(
        `Attempting reconnection ${
          currentCount + 1
        }/${MAX_RECONNECT_ATTEMPTS} to ${websocket.url}`
      );
      // Only remove the specific websocket that's reconnecting
      websockets = websockets.filter((oneWS) => oneWS !== websocket);
      reconnectTimeouts.delete(host);
      initialize({ dispatch }, config);
    }, jitteredDelay);

    reconnectTimeouts.set(host, timeoutId);
  };

  /**
   * Close the WebSocket connection and cleanup
   */
  const close = (url) => {
    if (url === null || url === undefined) return;
    const host = url.split("&token")[0];

    // Clear any pending reconnect timeout
    if (reconnectTimeouts.has(host)) {
      clearTimeout(reconnectTimeouts.get(host));
      reconnectTimeouts.delete(host);
    }

    // Reset reconnect count when connection is closed explicitly
    reconnectCounts.delete(host);

    // Close matching sockets
    for (const oneWS of websockets) {
      if (oneWS.url.startsWith(host)) {
        console.log(`Closing WebSocket connection to ${oneWS.url} ...`);
        oneWS.close();
      }
    }

    // Next remove them from array
    // websockets = websockets.filter((oneWS) => !oneWS.url.startsWith(host));
  };

  const send = (ws, payload, retries) => {
    if (ws.readyState === 1) ws.send(payload);
    else if (retries > 0) {
      setTimeout(() => send(ws, payload, retries - 1), 500);
    }
  };

  /**
   * The primary Redux middleware function.
   * Each of the actions handled are user-dispatched.
   */
  return (store) => (next) => (action) => {
    switch (action.type) {
      // User request to connect
      case WEBSOCKET_CONNECT:
        close(action.url);
        initialize(store, action.payload);
        next(action);
        break;

      // User request to disconnect
      case WEBSOCKET_DISCONNECT:
        close(action.url);
        next(action);
        break;

      // User request to send a text message
      case WEBSOCKET_SEND_TEXT:
        const message = JSON.stringify(action.payload);
        for (const oneWS of websockets) {
          if (oneWS.url === action.url) {
            //websockets[i].send(message);
            send(oneWS, message, 2);
            next(action);
            return;
          }
        }
        console.warn(
          "WebSocket is closed, ignoring text message (%s). Trigger a WEBSOCKET_CONNECT first.",
          message
        );
        break;

      // User request to send a text message
      case WEBSOCKET_SEND_BINARY:
        for (const oneWS of websockets) {
          if (oneWS.url === action.url) {
            send(oneWS, action.payload, 2);
            next(action);
            return;
          }
        }
        console.warn(
          "WebSocket is closed, ignoring binary message. Trigger a WEBSOCKET_CONNECT first."
        );
        break;

      // User request to simulate an error
      case WEBSOCKET_SIMULATE_ERROR:
        for (const oneWS of websockets) {
          if (oneWS.url === action.url) {
            console.log(`Simulating WebSocket error for ${oneWS.url}`);
            oneWS.close(4000, "Simulated error for testing.");
            break;
          }
        }
        next(action);
        break;

      default:
        next(action);
    }
  };
};

export default createMiddleware();
