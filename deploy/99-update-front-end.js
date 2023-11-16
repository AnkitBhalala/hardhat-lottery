const { network, ethers } = require("hardhat");
const fs = require("fs");

const frontEndContractsFile = "../lottery-front-end/constants/contractAddresses.json";
const frontEndAbiFile = "../lottery-front-end/constants/abi.json";

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Writing to front end...");
    await updateContractAddresses();
    await updateAbi();
    console.log("Front end written!");
  }
};

async function updateAbi() {
  const lottery = await ethers.getContract("Lottery");
  fs.writeFileSync(frontEndAbiFile, lottery.interface.format(ethers.utils.FormatTypes.json));
}

async function updateContractAddresses() {
  const lottery = await ethers.getContract("Lottery");
  const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf-8"));
  const chainId = network.config.chainId.toString();
  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId].includes(lottery.address)) {
      contractAddresses[chainId].push(lottery.address);
    }
  } else {
    contractAddresses[chainId] = [lottery.address];
  }
  fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses));
}
