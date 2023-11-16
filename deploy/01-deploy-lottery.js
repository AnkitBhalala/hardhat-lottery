const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = ethers.utils.parseEther("2"); // 1 Ether, or 1e18 (10^18) Wei

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  let vrfCoordinatorV2Mock, vrfCoordinatorV2Address, subscriptionId;

  const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;

  if (developmentChains.includes(network.name)) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;
    // Fund the subscription
    // Our mock makes it so we don't actually have to worry about sending fund
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];

  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  if (developmentChains.includes(network.name)) {
    // to add a consumer => otherwise some test case may have issue
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
  }

  // const l = await ethers.getContract("Lottery");

  // const time = (await l.getLastTimeStamp()).toString();

  // const intervalC = (await l.getInterval()).toString();

  // console.log({ time, intervalC });

  // Verify the deployment
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verify(lottery.address, args);
  }
};

module.exports.tags = ["all", "lottery"];

// 0x4aFfb136160340F425e458F4369A7c0bFa15ecC6 => contract address where it been deployed
// 0x7Ae40a3AcE7a52737168921c7D40bef420Ac5B10
// 0x52Ef59e9223ad24ccc107Dae820632A44f6cB9a8

// 0xD002f8152eDf43C3a867Cb8aaceAB3C39DbBB872
