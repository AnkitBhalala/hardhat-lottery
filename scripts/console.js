const { ethers } = require("hardhat");

async function enterLottery() {
  const lottery = await ethers.getContract("Lottery");

  const lastTime = (await lottery.getLastTimeStamp()).toString();
  const intervalC = (await lottery.getInterval()).toString();
  const currectTime = (await lottery.getBlockTimeStamp()).toString();

  console.log({ lastTime, intervalC, currectTime });
}

enterLottery()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
