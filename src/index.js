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

const createMiddleware = () => {
    // Hold a reference to the WebSocket instance in use.
    //let websocket: ?WebSocket;
    let websockets = new Array();

    /**
     * A function to create the WebSocket object and attach the standard callbacks
     */
    const initialize = ({dispatch}, config: Config) => {
        // Instantiate the websocket.
        const websocket = createWebsocket(config);

        // Function will dispatch actions returned from action creators.
        const dispatchAction = partial(compose, [dispatch]);

        // Setup handlers to be called like this:
        // dispatch(open(event));
        websocket.onopen = dispatchAction(open);
        websocket.onclose = dispatchAction(closed);
        websocket.onmessage = dispatchAction(message);

        // An optimistic callback assignment for WebSocket objects that support this
        const onConnecting = dispatchAction(connecting);
        // Add the websocket as the 2nd argument (after the event).
        websocket.onconnecting = partialRight(onConnecting, [websocket]);

        websockets.push(websocket);
    };

    /**
     * Close the WebSocket connection and cleanup
     */
    const close = (url) => {
        for (let i=0; i < websockets.length; i++ )
        {
            if (websockets[i].url === url)
            {
                console.warn(`Closing WebSocket connection to ${websockets[i].url} ...`);
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
