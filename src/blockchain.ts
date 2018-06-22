import * as CryptoJS from 'crypto-js';
import { Block } from './Block';
import {broadcastLatest} from './p2p';

/*
* create genesis block with hard coded information
*/
const genesisBlock: Block = new Block(0, '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7', '', 1465154705, 'Genesis Block');

/*
* create block chain
* initialize block chain with genesis block 
*/
let blockchain: Block[] = [genesisBlock];

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
  const nextIndex: number = previousBlock.index + 1;
  const nextTimestamp: number = new Date().getTime();
  const nextHash: string = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockInfo);
  const newBlock: Block = new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, blockInfo);
  addBlockToChain(newBlock);
  broadcastLatest();
  return newBlock;
}

/*
* based on block details calculate SHA256 hash for block 
*/
const calculateHash = (index: number, previousHash: string, timestamp: number, data: string): string => 
CryptoJS.SHA256(index + previousHash + timestamp + data).toString();

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
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
    console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
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
calculateHash(block.index, block.previousHash, block.timestamp, block.data);

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
  if (isValidChain(newBlocks) && newBlocks.length > getBlockchain().length) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
    blockchain = newBlocks;
    broadcastLatest();
  } else {
    console.log('Received blockchain invalid');
  }
};

export {Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, replaceChain, addBlockToChain};