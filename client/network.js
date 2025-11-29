// Network manager for WebSocket communication
class NetworkManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.connected = false;
        this.messageHandlers = {};
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {

            this.connected = true;
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {

            }
        };

        this.ws.onclose = () => {

            this.connected = false;
            this.emit('disconnected');
        };

        this.ws.onerror = (error) => {

            this.emit('error', error);
        };
    }

    handleMessage(data) {
        const handler = this.messageHandlers[data.type];
        if (handler) {
            handler(data);
        }
        this.emit('message', data);
    }

    on(event, handler) {
        this.messageHandlers[event] = handler;
    }

    emit(event, data) {
        // Simple event emitter for connection events
        if (event === 'connected' && this.onConnected) {
            this.onConnected();
        } else if (event === 'disconnected' && this.onDisconnected) {
            this.onDisconnected();
        }
    }

    send(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        } else {

        }
    }

    createRoom() {
        this.send('createRoom');
    }

    createRoomWithLevel(level) {
        // Send only the necessary level data (blocks, name, id)
        this.send('createRoomWithLevel', { 
            level: {
                id: level.id,
                name: level.name,
                blocks: level.blocks
            }
        });
    }

    joinRoom(roomId) {
        this.send('joinRoom', { roomId: roomId.toUpperCase() });
    }

    sendBounce() {
        this.send('bounce');
    }

    sendStateUpdate(state) {
        this.send('stateUpdate', { state });
    }

    playAgain() {
        this.send('playAgain');
    }

    skipCountdown() {
        this.send('skipCountdown');
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
