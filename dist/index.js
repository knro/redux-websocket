'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WEBSOCKET_MESSAGE = exports.WEBSOCKET_CLOSED = exports.WEBSOCKET_OPEN = exports.WEBSOCKET_CONNECTING = exports.WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND = exports.WEBSOCKET_DISCONNECT = exports.WEBSOCKET_CONNECT = undefined;

var _redux = require('redux');

var _partial = require('lodash/fp/partial');

var _partial2 = _interopRequireDefault(_partial);

var _partialRight = require('lodash/fp/partialRight');

var _partialRight2 = _interopRequireDefault(_partialRight);

var _actions = require('./actions');

var _websocket = require('./websocket');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Action types to be dispatched by the user
var WEBSOCKET_CONNECT = exports.WEBSOCKET_CONNECT = 'WEBSOCKET:CONNECT'; /* eslint-env browser */

var WEBSOCKET_DISCONNECT = exports.WEBSOCKET_DISCONNECT = 'WEBSOCKET:DISCONNECT';
var WEBSOCKET_SEND = exports.WEBSOCKET_SEND = 'WEBSOCKET:SEND';
var WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND_BINARY = 'WEBSOCKET:SEND_BINARY';
// Action types dispatched by the WebSocket implementation
var WEBSOCKET_CONNECTING = exports.WEBSOCKET_CONNECTING = 'WEBSOCKET:CONNECTING';
var WEBSOCKET_OPEN = exports.WEBSOCKET_OPEN = 'WEBSOCKET:OPEN';
var WEBSOCKET_CLOSED = exports.WEBSOCKET_CLOSED = 'WEBSOCKET:CLOSED';
var WEBSOCKET_MESSAGE = exports.WEBSOCKET_MESSAGE = 'WEBSOCKET:MESSAGE';

var createMiddleware = function createMiddleware() {
  // Hold a reference to the WebSocket instance in use.
  var websocket = void 0;

  /**
   * A function to create the WebSocket object and attach the standard callbacks
   */
  var initialize = function initialize(_ref, config) {
    var dispatch = _ref.dispatch;

    // Instantiate the websocket.
    websocket = (0, _websocket.createWebsocket)(config);

    // Function will dispatch actions returned from action creators.
    var dispatchAction = (0, _partial2.default)(_redux.compose, [dispatch]);

    // Setup handlers to be called like this:
    // dispatch(open(event));
    websocket.onopen = dispatchAction(_actions.open);
    websocket.onclose = dispatchAction(_actions.closed);
    websocket.onmessage = dispatchAction(_actions.message);

    // An optimistic callback assignment for WebSocket objects that support this
    var onConnecting = dispatchAction(_actions.connecting);
    // Add the websocket as the 2nd argument (after the event).
    websocket.onconnecting = (0, _partialRight2.default)(onConnecting, [websocket]);
  };

  /**
   * Close the WebSocket connection and cleanup
   */
  var close = function close() {
    if (websocket) {
      console.warn('Closing WebSocket connection to ' + websocket.url + ' ...');
      websocket.close();
      websocket = null;
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
            close();
            initialize(store, action.payload);
            next(action);
            break;

          // User request to disconnect
          case WEBSOCKET_DISCONNECT:
            close();
            next(action);
            break;

          // User request to send a message
          case WEBSOCKET_SEND:
            if (websocket) {
              websocket.send(JSON.stringify(action.payload));
            } else {
              console.warn('WebSocket is closed, ignoring. Trigger a WEBSOCKET_CONNECT first.');
            }
            next(action);
            break;

          // User request to send a message
          case WEBSOCKET_SEND_BINARY:
            if (websocket) {
              websocket.send(action.payload);
            } else {
              console.warn('WebSocket is closed, ignoring. Trigger a WEBSOCKET_CONNECT first.');
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