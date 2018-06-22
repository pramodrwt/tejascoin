import * as bodyParser from 'body-parser';
import * as express from 'express';

import { Block } from './Block';
import {generateNextBlock, getBlockchain} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';

const httpPort: number = 8100;
const p2pPort: number = 9001;

const initHttpServer = (httpPort:number) => {
  const app = express();

  //add middleware for body parser
  app.use(bodyParser.json());

  //start http server
  app.listen(httpPort, () => {
    console.log('Listening http on port: '+ httpPort);
  });

  //route to get all the blocks from blockchain
  app.get('/blocks', (req, res) => {
    res.send(getBlockchain());
  });

  //route to add new block into blockchain
  app.post('/addBlock', (req, res) => {
    const newBlock: Block = generateNextBlock(req.body.data);
    res.send(newBlock);
  });

  //route to get all peers from network
  app.get('/peers', (req, res) => {
    res.send(getSockets().map(( s: any ) => s._socket.remoteAddress + ':' + s._socket.remotePort));
  });

  //route to new peer to newtwork
  app.post('/addPeer', (req, res) => {
    connectToPeers(req.body.peer);
    res.send();
  });

}

//initialize http server
initHttpServer(httpPort);

//initialize P2P server
initP2PServer(p2pPort);