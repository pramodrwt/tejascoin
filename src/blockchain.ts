import * as CryptoJS from 'crypto-js';
import { Block } from './Block';
import {broadcastLatest} from './p2p';
import {hexToBinary} from './util';

/*
* create genesis block with hard coded information
*/
const genesisBlock: Block = new Block(0, '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7', '', 1465154705, 'Genesis Block',0,0);

/*
* create block chain
* initialize block chain with genesis block 
*/
let blockchain: Block[] = [genesisBlock];
//in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;
//in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

/*
* getter for block chain
*/
const getBlockchain = (): Block[] => blockchain;

/*
* getter for latestes block from blockchain
*/
const getLatestBlock = (): Block => blockchain[blockchain.length - 1];


/*
* generate next block
* get latest block, calculate hash for next block
* add to block chain
*/
const generateNextBlock = (blockInfo: string) => {
  const previousBlock: Block = getLatestBlock();
  const difficulty: number = getDifficulty(getBlockchain());
  const nextIndex: number = previousBlock.index + 1;
  const nextTimestamp: number = getCurrentTimestamp();
  const newBlock: Block = mineBlock(nextIndex, previousBlock.hash, nextTimestamp, blockInfo, difficulty);
  addBlockToChain(newBlock);
  broadcastLatest();
  return newBlock;
};

/*
* based on block details calculate SHA256 hash for block 
*/
const calculateHash = (index: number, previousHash: string, timestamp: number, data: string,
  difficulty: number, nonce: number): string =>
CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();


const getDifficulty = (aBlockchain: Block[]): number => {
  const latestBlock: Block = aBlockchain[blockchain.length - 1];
  if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
    return getAdjustedDifficulty(latestBlock, aBlockchain);
  } else {
    return latestBlock.difficulty;
  }
};


const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
  const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
  } else {
    return prevAdjustmentBlock.difficulty;
  }
};

/*
* calculate current timestamp (in seconds)
*/
const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

/*
* mine a new block based on difficulty and nonce 
*/
const mineBlock = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number): Block => {
  let nonce = 0;
  while (true) {
    const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
    }
    nonce++;
  }
};

/*
* cumulative difficulty of a chain we calculate 2^difficulty for each block and take a sum of all those numbers
*/
const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
  return aBlockchain
  .map((block) => block.difficulty)
  .map((difficulty) => Math.pow(2, difficulty))
  .reduce((a, b) => a + b);
};

/*
* validate timestamp for block based on..
*   a block is valid, if the timestamp is at most 1 min in the future from the time we perceive.
*   a block in the chain is valid, if the timestamp is at most 1 min in the past of the previous block.
*/
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  return ( previousBlock.timestamp - 60 < newBlock.timestamp )
  && newBlock.timestamp - 60 < getCurrentTimestamp();
};

/*
* validate hash based on content and difficulty
*/
const hasValidHash = (block: Block): boolean => {
  if (!hashMatchesBlockContent(block)) {
    console.log('Invalid hash, got:' + block.hash);
    return false;
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log('Block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
  }
  return true;
};

/*
* regenreate hash for block and match with block hash
*/
const hashMatchesBlockContent = (block: Block): boolean => {
  const blockHash: string = calculateHashForBlock(block);
  return blockHash === block.hash;
};

/*
* validate generated hash code based on difficulty
*/
const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
  const hashInBinary: string = hexToBinary(hash);
  const requiredPrefix: string = '0'.repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
};

/*
* validate block, if block valid add it to block chain
*/
const addBlockToChain = (newBlock: Block) => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
    return true;
  }
  return false;
};

/*
* validate block based on it's structure
* verify block hash code with previous block
* recalculate hash for block again and validate with it's current hash
*/
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (!isValidBlockStructure(newBlock)) {
    console.log('invalid structure');
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log('invalid index');
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log('invalid previoushash');
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log('invalid timestamp');
    return false;
  } else if (!hasValidHash(newBlock)) {
    return false;
  }
  return true;
};
/*
* validate block structure by it's type
*/
const isValidBlockStructure = (block: Block): boolean => {
  return typeof block.index === 'number'
  && typeof block.hash === 'string'
  && typeof block.previousHash === 'string'
  && typeof block.timestamp === 'number'
  && typeof block.data === 'string';
};

/*
* calculate hash for block based on block details
*/
const calculateHashForBlock = (block: Block): string =>
calculateHash(block.index, block.previousHash, block.timestamp,  block.data, block.difficulty, block.nonce);

/*
* validate genesis block and each block of block chain 
*/
const isValidChain = (blockchainToValidate: Block[]): boolean => {
  const isValidGenesis = (block: Block): boolean => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };

  if (!isValidGenesis(blockchainToValidate[0])) {
    return false;
  }

  for (let i = 1; i < blockchainToValidate.length; i++) {
    if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
      return false;
    }
  }
  return true;
};

/*
* replace current blockchain with received blockchain
* current block chain will be overridden by the longer chain
*/
const replaceChain = (newBlocks: Block[]) => {
  if (isValidChain(newBlocks) &&
    getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
  blockchain = newBlocks;
  broadcastLatest();
} else {
  console.log('Received blockchain invalid');
}
};

export {Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, replaceChain, addBlockToChain};