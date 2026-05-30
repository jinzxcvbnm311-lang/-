import { Peer, type DataConnection } from 'peerjs';
import { PlayerState, NetworkMessage, GameEventLog } from './types';

export class P2PManager {
  private peer: Peer | null = null;
  private connectionToHost: DataConnection | null = null;
  private clientConnections: Record<string, DataConnection> = {};
  
  public myId: string = '';
  public myName: string = 'User';
  public isHost: boolean = false;
  
  // Callbacks
  private onPeerOpenCallback: ((id: string) => void) | null = null;
  private onConnectionOpenedCallback: ((conn: DataConnection) => void) | null = null;
  private onMessageReceivedCallback: ((msg: NetworkMessage) => void) | null = null;
  private onErrorCallback: ((err: any) => void) | null = null;
  private onDisconnectCallback: ((id: string) => void) | null = null;

  constructor(name: string) {
    this.myName = name;
    // Generate a simple unique local ID
    this.myId = 'player_' + Math.random().toString(36).substring(2, 9);
  }

  // Set event callbacks
  public onPeerOpen(cb: (id: string) => void) { this.onPeerOpenCallback = cb; }
  public onConnectionOpened(cb: (conn: DataConnection) => void) { this.onConnectionOpenedCallback = cb; }
  public onMessageReceived(cb: (msg: NetworkMessage) => void) { this.onMessageReceivedCallback = cb; }
  public onError(cb: (err: any) => void) { this.onErrorCallback = cb; }
  public onDisconnect(cb: (id: string) => void) { this.onDisconnectCallback = cb; }

  /**
   * Initializes host P2P server
   */
  public startHost(customPin?: string): Promise<string> {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      try {
        // Generate a standard room ID format. If custom PIN is not specified, generate a 5-digit number
        const pin = customPin || Math.floor(10000 + Math.random() * 90000).toString();
        const peerId = `p2p-mining-room-${pin}`;

        this.peer = new Peer(peerId, {
          debug: 1,
        });

        this.peer.on('open', (id) => {
          console.log('Host peer started with ID:', id);
          if (this.onPeerOpenCallback) this.onPeerOpenCallback(pin);
          resolve(pin);
        });

        this.peer.on('connection', (conn) => {
          console.log('Client connected to Host:', conn.peer);
          
          this.clientConnections[conn.peer] = conn;
          
          conn.on('open', () => {
            if (this.onConnectionOpenedCallback) this.onConnectionOpenedCallback(conn);
          });

          conn.on('data', (data) => {
            try {
              const msg = data as NetworkMessage;
              if (this.onMessageReceivedCallback) this.onMessageReceivedCallback(msg);
            } catch (err) {
              console.error('Error handling client data:', err);
            }
          });

          conn.on('close', () => {
            console.log('Client connection closed:', conn.peer);
            delete this.clientConnections[conn.peer];
            if (this.onDisconnectCallback) this.onDisconnectCallback(conn.peer);
          });

          conn.on('error', (err) => {
            console.error('Connection error with client:', conn.peer, err);
            delete this.clientConnections[conn.peer];
            if (this.onDisconnectCallback) this.onDisconnectCallback(conn.peer);
          });
        });

        this.peer.on('error', (err) => {
          console.error('Host peer error:', err);
          if (this.onErrorCallback) this.onErrorCallback(err);
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Connect to Host using a room code (PIN)
   */
  public joinRoom(pin: string): Promise<boolean> {
    this.isHost = false;
    return new Promise((resolve, reject) => {
      try {
        const hostPeerId = `p2p-mining-room-${pin}`;
        
        this.peer = new Peer({
          debug: 1,
        });

        this.peer.on('open', (myPeerId) => {
          console.log('My Client peer ID:', myPeerId);
          if (this.onPeerOpenCallback) this.onPeerOpenCallback(myPeerId);

          const conn = this.peer!.connect(hostPeerId, {
            metadata: { name: this.myName, id: this.myId }
          });

          this.connectionToHost = conn;

          conn.on('open', () => {
            console.log('Connected dynamically to Host!');
            
            // Send join handshake message
            this.sendToHost({
              type: 'JOIN',
              senderId: this.myId,
              senderName: this.myName,
              payload: { name: this.myName }
            });

            if (this.onConnectionOpenedCallback) this.onConnectionOpenedCallback(conn);
            resolve(true);
          });

          conn.on('data', (data) => {
            try {
              const msg = data as NetworkMessage;
              if (this.onMessageReceivedCallback) this.onMessageReceivedCallback(msg);
            } catch (err) {
              console.error('Error parsing host data:', err);
            }
          });

          conn.on('close', () => {
            console.log('Host connection closed');
            if (this.onDisconnectCallback) this.onDisconnectCallback(hostPeerId);
          });

          conn.on('error', (err) => {
            console.error('Host connection error:', err);
            if (this.onErrorCallback) this.onErrorCallback(err);
            reject(err);
          });
        });

        this.peer.on('error', (err) => {
          console.error('Client peer error:', err);
          if (this.onErrorCallback) this.onErrorCallback(err);
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send network message to the Host (Client mode)
   */
  public sendToHost(message: NetworkMessage) {
    if (this.connectionToHost && this.connectionToHost.open) {
      this.connectionToHost.send(message);
    }
  }

  /**
   * Send network message to a specific Client (Host mode)
   */
  public sendToClient(clientPeerId: string, message: NetworkMessage) {
    const conn = this.clientConnections[clientPeerId];
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  /**
   * Broadcast message to all Clients (Host mode)
   */
  public broadcast(message: NetworkMessage) {
    Object.values(this.clientConnections).forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  /**
   * Shut down connections and peer
   */
  public disconnect() {
    if (this.connectionToHost) {
      this.connectionToHost.close();
      this.connectionToHost = null;
    }
    
    Object.values(this.clientConnections).forEach((conn) => {
      conn.close();
    });
    this.clientConnections = {};

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
