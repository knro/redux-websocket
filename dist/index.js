'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.WEBSOCKET_MESSAGE = exports.WEBSOCKET_CLOSED = exports.WEBSOCKET_ERROR = exports.WEBSOCKET_OPEN = exports.WEBSOCKET_CONNECTING = exports.WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND_TEXT = exports.WEBSOCKET_DISCONNECT = exports.WEBSOCKET_CONNECT = undefined;

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
var WEBSOCKET_SEND_TEXT = exports.WEBSOCKET_SEND_TEXT = 'WEBSOCKET:SEND_TEXT';
var WEBSOCKET_SEND_BINARY = exports.WEBSOCKET_SEND_BINARY = 'WEBSOCKET:SEND_BINARY';
// Action types dispatched by the WebSocket implementation
var WEBSOCKET_CONNECTING = exports.WEBSOCKET_CONNECTING = 'WEBSOCKET:CONNECTING';
var WEBSOCKET_OPEN = exports.WEBSOCKET_OPEN = 'WEBSOCKET:OPEN';
var WEBSOCKET_ERROR = exports.WEBSOCKET_ERROR = 'WEBSOCKET:ERROR';
var WEBSOCKET_CLOSED = exports.WEBSOCKET_CLOSED = 'WEBSOCKET:CLOSED';
var WEBSOCKET_MESSAGE = exports.WEBSOCKET_MESSAGE = 'WEBSOCKET:MESSAGE';

var MAX_RECONNECT_ATTEMPTS = 500;

var createMiddleware = function createMiddleware() {
    // Hold a reference to the WebSocket instance in use.
    //let websocket: ?WebSocket;
    var websockets = [];

    /**
     * A function to create the WebSocket object and attach the standard callbacks
     */
    var initialize = function initialize(_ref, config) {
        var dispatch = _ref.dispatch;

        // Instantiate the websocket.
        var websocket = (0, _websocket.createWebsocket)(config);

        websocket.reconnects = 0;
        // Web browsers define URL
        // But on devices it is not defined for some reason
        if (websocket.url === undefined) websocket.url = config.url;

        // Function will dispatch actions returned from action creators.
        var dispatchAction = (0, _partial2.default)(_redux.compose, [dispatch]);

        // On Opening socket
        websocket.onopen = dispatchAction(_actions.open);
        // On receiving message
        websocket.onmessage = dispatchAction(_actions.message);
        // On Closing socket
        websocket.onclose = function (event) {
            dispatchAction(_actions.closed)(event);

            if ((event.code && event.code > 1000 || event.message) && websocket.reconnects < MAX_RECONNECT_ATTEMPTS) reconnect(websocket, dispatch, config);
        };
        // On socket error
        websocket.onerror = function (event) {
            dispatchAction(_actions.error)(event);
            console.error("WebSocket error observed:", event);
        };

        // An optimistic callback assignment for WebSocket objects that support this
        var onConnecting = dispatchAction(_actions.connecting);
        // Add the websocket as the 2nd argument (after the event).
        websocket.onconnecting = (0, _partialRight2.default)(onConnecting, [websocket]);

        websockets.push(websocket);
    };

    var reconnect = function reconnect(websocket, dispatch, config) {
        var timeout = 5000 + websocket.reconnects * 250;
        websocket.reconnects++;
        // If abnormal close, try to reconnect
        setTimeout(function () {
            console.log("Reconnecting websocket to " + websocket.url);
            var host = websocket.url.split("&token")[0];
            websockets = websockets.filter(function (oneWS) {
                return !oneWS.url.startsWith(host);
            });
            initialize({ dispatch: dispatch }, config);
        }, timeout);
    };

    /**
     * Close the WebSocket connection and cleanup
     */
    var close = function close(url) {
        var host = url.split("&token")[0];
        // Close matching sockets
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = websockets[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var oneWS = _step.value;

                if (oneWS.url.startsWith(host)) {
                    console.log('Closing WebSocket connection to ' + oneWS.url + ' ...');
                    oneWS.close();
                }
            }

            // Next remove them from array
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

        websockets = websockets.filter(function (oneWS) {
            return !oneWS.url.startsWith(host);
        });
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

                        console.warn('WebSocket is closed, ignoring text message (%s). Trigger a WEBSOCKET_CONNECT first.', _message);
                        break;

                    // User request to send a text message
                    case WEBSOCKET_SEND_BINARY:
                        var _iteratorNormalCompletion3 = true;
                        var _didIteratorError3 = false;
                        var _iteratorError3 = undefined;

                        try {
                            for (var _iterator3 = websockets[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                var _oneWS = _step3.value;

                                if (_oneWS === action.url) {
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

                        console.warn('WebSocket is closed, ignoring binary message. Trigger a WEBSOCKET_CONNECT first.');
                        break;

                    default:
                        next(action);
                }
            };
        };
    };
};

exports.default = createMiddleware();