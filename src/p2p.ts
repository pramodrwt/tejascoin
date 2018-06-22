import * as WebSocket from 'ws';
import {addBlockToChain, Block, getBlockchain, getLatestBlock, isValidBlockStructure, replaceChain} from './blockchain';

const sockets: WebSocket[] = [];

/*
* initialize P2P server and listner for connection
*/
const initP2PServer = (p2pPort: number) => {
  const server: WebSocket.Server = new WebSocket.Server({port: p2pPort});
  server.on('connection', (ws: WebSocket) => {
    initConnection(ws);
  });
  console.log('Listening websocket p2p port on: ' + p2pPort);
}

/*
* config for message 
*/
enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2,
}

/*
* define modal for message with type and data 
*/
class Message {
  public type: MessageType;
  public data: any;
}

/*
* getter for sockets
*/
const getSockets = () => sockets;

/*
* initialize new socket connection
*/
const initConnection = (ws: WebSocket) => {
  sockets.push(ws);
  initMessageHandler(ws);
  initErrorHandler(ws);
  write(ws, queryChainLengthMsg());
};

/*
* parse data to json object and map it to given data type
*/
const JSONToObject = <T>(data: string): T => {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log(e);
    return null;
  }
};

/*
* add event for message, validate/parse message
* based on message type send back repsonse 
*/
const initMessageHandler = (ws: WebSocket) => {
  ws.on('message', (data: string) => {
    const message: Message = JSONToObject<Message>(data);
    if (message === null) {
      console.log('could not parse received JSON message: ' + data);
      return;
    }
    console.log('Received message' + JSON.stringify(message));
    switch (message.type) {
      case MessageType.QUERY_LATEST:
      write(ws, responseLatestMsg());
      break;
      case MessageType.QUERY_ALL:
      write(ws, responseChainMsg());
      break;
      case MessageType.RESPONSE_BLOCKCHAIN:
      const receivedBlocks: Block[] = JSONToObject<Block[]>(message.data);
      if (receivedBlocks === null) {
        console.log('invalid blocks received:');
        console.log(message.data)
        break;
      }
      handleBlockchainResponse(receivedBlocks);
      break;
    }
  });
};

/*
* send response back with messge 
*/
const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message));

/*
* response for blockchain request
*/
const responseChainMsg = (): Message => ({
  'type': MessageType.RESPONSE_BLOCKCHAIN, 
  'data': JSON.stringify(getBlockchain())
});

/*
* response for latest block from blockchain
*/
const responseLatestMsg = (): Message => ({
  'type': MessageType.RESPONSE_BLOCKCHAIN,
  'data': JSON.stringify([getLatestBlock()])
});

/*
* handler for blockchain response
* validate blockchain and add to blockchain and broadcast
*/
const handleBlockchainResponse = (receivedBlocks: Block[]) => {
  if (receivedBlocks.length === 0) {
    console.log('received block chain size of 0');
    return;
  }
  const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
  if (!isValidBlockStructure(latestBlockReceived)) {
    console.log('block structuture not valid');
    return;
  }
  const latestBlockHeld: Block = getLatestBlock();
  if (latestBlockReceived.index > latestBlockHeld.index) {
    console.log('blockchain possibly behind. We got: '
      + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
      if (addBlockToChain(latestBlockReceived)) {
        broadcast(responseLatestMsg());
      }
    } else if (receivedBlocks.length === 1) {
      console.log('We have to query the chain from our peer');
      broadcast(queryAllMsg());
    } else {
      console.log('Received blockchain is longer than current blockchain');
      replaceChain(receivedBlocks);
    }
  } else {
    console.log('received blockchain is not longer than received blockchain. Do nothing');
  }
};

/*
* query for blockchain from peers
*/
const queryAllMsg = (): Message => ({'type': MessageType.QUERY_ALL, 'data': null});

/*
* add handler for slose connection and error
* remove appropiate socket connection from connections list
*/
const initErrorHandler = (ws: WebSocket) => {
  const closeConnection = (myWs: WebSocket) => {
    console.log('connection failed to peer: ' + myWs.url);
    sockets.splice(sockets.indexOf(myWs), 1);
  };
  ws.on('close', () => closeConnection(ws));
  ws.on('error', () => closeConnection(ws));
};

/*
* borad cast message to all peers in the network
*/
const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message));

/*
* query for latest block from blockchain
*/
const queryChainLengthMsg = (): Message => ({'type': MessageType.QUERY_LATEST, 'data': null});

/*
* borad cast latest block from blockchain
*/
const broadcastLatest = (): void => {
  broadcast(responseLatestMsg());
};

/*
* connect new peers to network 
*/
const connectToPeers = (newPeer: string): void => {
  const ws: WebSocket = new WebSocket(newPeer);
  ws.on('open', () => {
    initConnection(ws);
  });
  ws.on('error', () => {
    console.log('connection failed');
  });
};

export {connectToPeers, broadcastLatest, initP2PServer, getSockets};