"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WEBSOCKET_MESSAGE = exports.WEBSOCKET_CLOSED = exports.WEBSOCKET_ERROR = exports.WEBSOCKET_OPEN = exports.WEBSOCKET_CONNECTING = exports.WEBSOCKET_SIMULATE_ERROR = exports.WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND_TEXT = exports.WEBSOCKET_DISCONNECT = exports.WEBSOCKET_CONNECT = undefined;

var _actions = require("./actions");

var _websocket = require("./websocket");

// Action types to be dispatched by the user
/* eslint-env browser */
var WEBSOCKET_CONNECT = exports.WEBSOCKET_CONNECT = "WEBSOCKET:CONNECT";
var WEBSOCKET_DISCONNECT = exports.WEBSOCKET_DISCONNECT = "WEBSOCKET:DISCONNECT";
var WEBSOCKET_SEND_TEXT = exports.WEBSOCKET_SEND_TEXT = "WEBSOCKET:SEND_TEXT";
var WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND_BINARY = "WEBSOCKET:SEND_BINARY";
var WEBSOCKET_SIMULATE_ERROR = exports.WEBSOCKET_SIMULATE_ERROR = "WEBSOCKET:SIMULATE_ERROR";
// Action types dispatched by the WebSocket implementation
var WEBSOCKET_CONNECTING = exports.WEBSOCKET_CONNECTING = "WEBSOCKET:CONNECTING";
var WEBSOCKET_OPEN = exports.WEBSOCKET_OPEN = "WEBSOCKET:OPEN";
var WEBSOCKET_ERROR = exports.WEBSOCKET_ERROR = "WEBSOCKET:ERROR";
var WEBSOCKET_CLOSED = exports.WEBSOCKET_CLOSED = "WEBSOCKET:CLOSED";
var WEBSOCKET_MESSAGE = exports.WEBSOCKET_MESSAGE = "WEBSOCKET:MESSAGE";

var MAX_RECONNECT_ATTEMPTS = 10;
var INITIAL_RECONNECT_DELAY = 1000;
var MAX_RECONNECT_DELAY = 30000;

var createMiddleware = function createMiddleware() {
  // Hold a reference to the WebSocket instance in use.
  //let websocket: ?WebSocket;
  var websockets = [];
  // Keep track of reconnection timeouts and counts
  var reconnectTimeouts = new Map();
  var reconnectCounts = new Map();

  var getPurposeFromUrl = function getPurposeFromUrl(url) {
    if (!url) return "";
    // Extracts the path from a WebSocket URL, e.g., /media/user from ws://...
    var match = url.match(/^wss?:\/\/[^/]+(\/[^?]*)/);
    return match ? match[1] : "";
  };

  /**
   * A function to create the WebSocket object and attach the standard callbacks
   */
  var initialize = function initialize(_ref, config) {
    var dispatch = _ref.dispatch;

    // Instantiate the websocket.
    var websocket = (0, _websocket.createWebsocket)(config);
    // Web browsers define URL
    // But on devices it is not defined for some reason
    if (websocket.url === undefined) websocket.url = config.url;

    // Function will dispatch actions returned from action creators.
    var dispatchAction = function dispatchAction(actionCreator) {
      return function (event) {
        dispatch(actionCreator(event));
      };
    };

    // On Opening socket
    websocket.onopen = dispatchAction(_actions.open);
    // On receiving message
    websocket.onmessage = dispatchAction(_actions.message);
    // On Closing socket
    websocket.onclose = function (event) {
      dispatch((0, _actions.closed)(event));

      // If our website was removed from list, do not attempt to reconnect
      if (!websockets.includes(websocket)) return;

      // Check if we have an active connection for the same purpose (e.g. message or media).
      // This allows different services to reconnect independently.
      var purpose = getPurposeFromUrl(websocket.url);
      var hasActiveConnectionForSamePurpose = websockets.some(function (ws) {
        return ws !== websocket && getPurposeFromUrl(ws.url) === purpose && ws.readyState === 1;
      });

      if (hasActiveConnectionForSamePurpose) {
        console.log("Another active connection for " + purpose + " exists. Not attempting reconnection to " + websocket.url);
        return;
      }

      var host = websocket.url.split("&token")[0];
      var currentCount = reconnectCounts.get(host) || 0;

      if (event.code && event.code > 1000 || event.message) {
        console.log("WebSocket closed abnormally for " + websocket.url + ":", "\n- Code: " + (event.code || "none"), "\n- Reason: " + (event.reason || "none"), "\n- Message: " + (event.message || "none"), "\n- Current reconnection attempts: " + currentCount);

        if (currentCount >= MAX_RECONNECT_ATTEMPTS) {
          console.warn("Maximum reconnection attempts (" + MAX_RECONNECT_ATTEMPTS + ") reached for " + host + ". Giving up.");
          return;
        }

        reconnect(websocket, dispatch, config);
      } else {
        console.log("WebSocket closed normally for " + websocket.url, "\n- Code: " + (event.code || "none"), "\n- Reason: " + (event.reason || "none"));
        websockets = websockets.filter(function (ws) {
          return ws !== websocket;
        });
      }
    };
    // On socket error
    websocket.onerror = function (event) {
      dispatch((0, _actions.error)(event));
      console.error("WebSocket error observed:", event);
    };

    // An optimistic callback assignment for WebSocket objects that support this
    websocket.onconnecting = function (event) {
      dispatch((0, _actions.connecting)(event, websocket));
    };

    websockets.push(websocket);
  };

  var reconnect = function reconnect(websocket, dispatch, config) {
    var host = websocket.url.split("&token")[0];
    var currentCount = reconnectCounts.get(host) || 0;
    var nextCount = currentCount + 1;

    // Check if next attempt would exceed max attempts
    if (nextCount > MAX_RECONNECT_ATTEMPTS) {
      console.warn("Maximum reconnection attempts (" + MAX_RECONNECT_ATTEMPTS + ") reached for " + host);
      return;
    }

    // Double check for any active connections for the same purpose again for safety
    var purpose = getPurposeFromUrl(websocket.url);
    var hasActiveConnectionForSamePurpose = websockets.some(function (ws) {
      return ws !== websocket && getPurposeFromUrl(ws.url) === purpose && ws.readyState === 1;
    });
    if (hasActiveConnectionForSamePurpose) {
      console.log("Another active connection for " + purpose + " exists. Not attempting reconnection to " + websocket.url);
      return;
    }

    reconnectCounts.set(host, nextCount);

    // Calculate delay with exponential backoff and jitter
    var delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, currentCount), MAX_RECONNECT_DELAY);
    // Add some random jitter to prevent thundering herd
    var jitteredDelay = delay * (0.5 + Math.random());

    console.log("Scheduling reconnection attempt " + (currentCount + 1) + "/" + MAX_RECONNECT_ATTEMPTS + " for " + websocket.url + ":", "\n- Base delay: " + delay + "ms", "\n- With jitter: " + jitteredDelay + "ms");

    // Clear any existing timeout for this host
    if (reconnectTimeouts.has(host)) {
      clearTimeout(reconnectTimeouts.get(host));
    }

    // Store new timeout
    var timeoutId = setTimeout(function () {
      console.log("Attempting reconnection " + (currentCount + 1) + "/" + MAX_RECONNECT_ATTEMPTS + " to " + websocket.url);
      // Only remove the specific websocket that's reconnecting
      websockets = websockets.filter(function (oneWS) {
        return oneWS !== websocket;
      });
      reconnectTimeouts.delete(host);
      initialize({ dispatch: dispatch }, config);
    }, jitteredDelay);

    reconnectTimeouts.set(host, timeoutId);
  };

  /**
   * Close the WebSocket connection and cleanup
   */
  var close = function close(url) {
    if (url === null || url === undefined) return;
    var host = url.split("&token")[0];

    // Clear any pending reconnect timeout
    if (reconnectTimeouts.has(host)) {
      clearTimeout(reconnectTimeouts.get(host));
      reconnectTimeouts.delete(host);
    }

    // Reset reconnect count when connection is closed explicitly
    reconnectCounts.delete(host);

    // Close matching sockets
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = websockets[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var oneWS = _step.value;

        if (oneWS.url.startsWith(host)) {
          console.log("Closing WebSocket connection to " + oneWS.url + " ...");
          oneWS.close();
        }
      }

      // Next remove them from array
      // websockets = websockets.filter((oneWS) => !oneWS.url.startsWith(host));
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  };

  var send = function send(ws, payload, retries) {
    if (ws.readyState === 1) ws.send(payload);else if (retries > 0) {
      setTimeout(function () {
        return send(ws, payload, retries - 1);
      }, 500);
    }
  };

  /**
   * The primary Redux middleware function.
   * Each of the actions handled are user-dispatched.
   */
  return function (store) {
    return function (next) {
      return function (action) {
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
            var _message = JSON.stringify(action.payload);
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
              for (var _iterator2 = websockets[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var oneWS = _step2.value;

                if (oneWS.url === action.url) {
                  //websockets[i].send(message);
                  send(oneWS, _message, 2);
                  next(action);
                  return;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }

            console.warn("WebSocket is closed, ignoring text message (%s). Trigger a WEBSOCKET_CONNECT first.", _message);
            break;

          // User request to send a text message
          case WEBSOCKET_SEND_BINARY:
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = websockets[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var _oneWS = _step3.value;

                if (_oneWS.url === action.url) {
                  send(_oneWS, action.payload, 2);
                  next(action);
                  return;
                }
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }

            console.warn("WebSocket is closed, ignoring binary message. Trigger a WEBSOCKET_CONNECT first.");
            break;

          // User request to simulate an error
          case WEBSOCKET_SIMULATE_ERROR:
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
              for (var _iterator4 = websockets[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                var _oneWS2 = _step4.value;

                if (_oneWS2.url === action.url) {
                  console.log("Simulating WebSocket error for " + _oneWS2.url);
                  _oneWS2.close(4000, "Simulated error for testing.");
                  break;
                }
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }

            next(action);
            break;

          default:
            next(action);
        }
      };
    };
  };
};

exports.default = createMiddleware();