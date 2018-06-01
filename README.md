# redux-websocket

## Summary

A Redux middleware for managing data over a WebSocket connection.

This is forked from [redux-middelware-websocket](https://github.com/giantmachines/redux-websocket)

The above project provides WEBSOCKET_SEND method that always use JSON.stringify when it sends data to the server.
This is not desirable for binary objects, so this fork provides WEBSOCKET_SEND_TEXT and WEBSOCKET_SEND_BINARY methods instead.

This fork also supports multiple websockets per middleware. The only requirement is to send url as part of the payload object in all action creators.

