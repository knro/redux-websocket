"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* eslint-env browser */


/**
 * Formats args for creating the WebSocket instance
 */
var extractArgs = function extractArgs(config) {
  if (config.args) {
    return config.args;
  }

  if (config.url) {
    return [config.url];
  }

  return [];
};

/**
 * Create a websocket object from the incoming config
 */
var createWebsocket = exports.createWebsocket = function createWebsocket(payload) {
  var args = extractArgs(payload);
  var websocket = payload.websocket ? payload.websocket : WebSocket;

  return new (Function.prototype.bind.apply(websocket, [null].concat(_toConsumableArray(args))))();
};