import * as bodyParser from 'body-parser';
import * as express from 'express';

const httpPort: number = 8100;
const p2pPort: number = 9000;

const initHttpServer = (httpPort:number) => {
  const app = express();
  app.use(bodyParser.json());

  app.listen(httpPort, () => {
    console.log('Listening http on port: '+ httpPort);
  })
}

initHttpServer(httpPort);
//initP2PServer(p2pPort);