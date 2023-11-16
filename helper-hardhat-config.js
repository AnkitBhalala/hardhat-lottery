const { ethers } = require("hardhat");

const networkConfig = {
  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.1"),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    subscriptionId: "588",
    callbackGasLimit: "500000", // 500,000 gas
    interval: "30",
  },
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: ethers.utils.parseEther("0.1"),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    subscriptionId: "6623",
    callbackGasLimit: "5000000", // 500,000 gas
    interval: "180",
  },
  1: {
    name: "mainnet",
    interval: "30",
  },
};

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;

module.exports = {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
};
