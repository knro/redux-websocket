/* eslint-env browser */
/* @flow */
import {compose} from 'redux';
import partial from 'lodash/fp/partial';
import partialRight from 'lodash/fp/partialRight';
import {connecting, open, closed, message} from './actions';
import {createWebsocket} from './websocket';

// Action types to be dispatched by the user
export const WEBSOCKET_CONNECT = 'WEBSOCKET:CONNECT';
export const WEBSOCKET_DISCONNECT = 'WEBSOCKET:DISCONNECT';
export const WEBSOCKET_SEND_TEXT = 'WEBSOCKET:SEND_TEXT';
export const WEBSOCKET_SEND_BINARY = 'WEBSOCKET:SEND_BINARY';
// Action types dispatched by the WebSocket implementation
export const WEBSOCKET_CONNECTING = 'WEBSOCKET:CONNECTING';
export const WEBSOCKET_OPEN = 'WEBSOCKET:OPEN';
export const WEBSOCKET_CLOSED = 'WEBSOCKET:CLOSED';
export const WEBSOCKET_MESSAGE = 'WEBSOCKET:MESSAGE';

const MAX_RECONNECT_ATTEMPTS = 500;

const createMiddleware = () => {
    // Hold a reference to the WebSocket instance in use.
    //let websocket: ?WebSocket;
    let websockets = [];

    /**
     * A function to create the WebSocket object and attach the standard callbacks
     */
    const initialize = ({dispatch}, config: Config) => {
        // Instantiate the websocket.
        const websocket = createWebsocket(config);

        websocket.reconnects = 0;
        // Web browsers define URL
        // But on devices it is not defined for some reason
        if (websocket.url === undefined)
            websocket.url = config.url;

        // Function will dispatch actions returned from action creators.
        const dispatchAction = partial(compose, [dispatch]);

        // On Opening socket
        websocket.onopen = dispatchAction(open);
        // On receiving message
        websocket.onmessage = dispatchAction(message);
        // On Closing socket
        websocket.onclose = (event) =>
        {
            dispatchAction(closed)(event);
            if (event.code === 1006 && websocket.reconnects < MAX_RECONNECT_ATTEMPTS)
                reconnect(websocket, dispatch, config);

        };


        // An optimistic callback assignment for WebSocket objects that support this
        const onConnecting = dispatchAction(connecting);
        // Add the websocket as the 2nd argument (after the event).
        websocket.onconnecting = partialRight(onConnecting, [websocket]);

        websockets.push(websocket);
    };

    const reconnect = (websocket, dispatch, config) => {
        let timeout = 5000 + websocket.reconnects*250;
        websocket.reconnects++;
        // If abnormal close, try to reconnect
        setTimeout( function()
        {
            console.log("Reconnecting websocket to " + websocket.url);
            // Remove from list
            for (let i=0; i < websockets.length; i++ ) {
                if (websockets[i].url === websocket.url)
                    websockets.splice(i, 1);
            }
            initialize({dispatch}, config);
        }, timeout);
    };

    /**
     * Close the WebSocket connection and cleanup
     */
    const close = (url) => {
        for (let i=0; i < websockets.length; i++ )
        {
            if (websockets[i].url === url)
            {
                console.log(`Closing WebSocket connection to ${websockets[i].url} ...`);
                websockets[i].close();
                websockets.splice(i, 1);
            }
        }
    };

    /**
     * The primary Redux middleware function.
     * Each of the actions handled are user-dispatched.
     */
    return (store: Object) => (next: Function) => (action: Action) => {
        switch (action.type)
        {
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
                for (let i=0; i < websockets.length; i++ )
                {
                    if (websockets[i].url === action.url)
                    {
                        websockets[i].send(JSON.stringify(action.payload));
                        next(action);
                        return;
                    }
                }
                console.warn('WebSocket is closed, ignoring. Trigger a WEBSOCKET_CONNECT first.');
                break;


            // User request to send a text message
            case WEBSOCKET_SEND_BINARY:
                for (let i=0; i < websockets.length; i++ )
                {
                    if (websockets[i].url === action.url)
                    {
                        websockets[i].send(action.payload);
                        next(action);
                        return;
                    }
                }
                console.warn('WebSocket is closed, ignoring. Trigger a WEBSOCKET_CONNECT first.');
                break;

            default:
                next(action);
        }
    };
};

export default createMiddleware();
