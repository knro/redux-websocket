'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.message = exports.closed = exports.open = exports.connecting = undefined;

var _index = require('./index');

// These actions are more concerned with connection state
// and are trigged async by the WebSocketMiddleware

var connecting = exports.connecting = function connecting(event, websocket) {
  return {
    type: _index.WEBSOCKET_BINARY_CONNECTING,
    payload: {
      timestamp: new Date(),
      event: event,
      websocket: websocket
    }
  };
}; /* eslint-env browser */

var open = exports.open = function open(event) {
  return {
    type: _index.WEBSOCKET_BINARY_OPEN,
    payload: {
      timestamp: new Date(),
      event: event
    }
  };
};

var closed = exports.closed = function closed(event) {
  return {
    type: _index.WEBSOCKET_BINARY_CLOSED,
    payload: {
      timestamp: new Date(),
      event: event
    }
  };
};

var message = exports.message = function message(event) {
  return {
    type: _index.WEBSOCKET_BINARY_MESSAGE,
    payload: {
      timestamp: new Date(),
      data: event.data,
      event: event
    }
  };
};

exports.default = {};