const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery Unit Tests", () => {
      let lottery, vrfCoordinatorV2Mock, entranceFee, deployer, interval;
      const chainId = network.config.chainId;
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        lottery = await ethers.getContract("Lottery", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        entranceFee = await lottery.getEntranceFee();
        interval = await lottery.getInterval();
      });

      describe("constructor", () => {
        it("initializes the lottery correctly", async () => {
          const lotteryState = (await lottery.getLotteryState()).toString();
          // Comparisons for lottery initialization:
          assert.equal(lotteryState, "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enterLottery", () => {
        it("reverts when you don't pay enough", async () => {
          await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__SendMoreToEnterLottery");
        });

        it("records player when they enter", async () => {
          await lottery.enterLottery({ value: entranceFee });
          const player = await lottery.getPlayer(0);
          assert.equal(player, deployer);
        });

        it("emits event on enter", async () => {
          await expect(lottery.enterLottery({ value: entranceFee })).to.emit(lottery, "LotteryEnter");
        });

        it("doesn't allow entrance when lottery is calculating", async () => {
          await lottery.enterLottery({ value: entranceFee });
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await lottery.performUpkeep([]);
          await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith("Lottery__LotteryNotOpen");
        });

        it("Returns total number of player in the lottery", async () => {
          await lottery.enterLottery({ value: entranceFee });
          const additionalEntrances = 3;
          const startingIndex = 1;
          const accounts = await ethers.getSigners();
          for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
            const lotteryInstance = lottery.connect(accounts[i]);
            await lotteryInstance.enterLottery({ value: entranceFee });
          }
          const totalPlayer = await lottery.getNumberOfPlayers();
          assert.equal(totalPlayer.toNumber(), 4);
        });

        it("Should return currect requestConfirmations & numWords", async () => {
          const requestConfirmations = await lottery.getRequestConfirmations();
          const numWords = await lottery.getNumWords();
          assert.equal(requestConfirmations, 3);
          assert.equal(numWords, 1);
        });
      });

      describe("checkUpkeep", () => {
        it("returns false if none of the people enter in the lottery", async () => {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if lottery isn't open", async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await lottery.performUpkeep([]);
          const lotteryState = await lottery.getLotteryState();
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert.equal(lotteryState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert.equal(upkeepNeeded, false);
        });

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert.equal(upkeepNeeded, true);
        });
      });

      describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await lottery.performUpkeep([]);
          assert(tx);
        });

        it("reverts if checkup is false", async () => {
          await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded");
        });

        it("updates the lottery state and emits a requestId", async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await lottery.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const lotteryState = await lottery.getLotteryState();
          assert(requestId.toNumber() > 0);
          assert.equal(lotteryState, 1); // 0 = open, 1 = calculating
        });
      });

      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await lottery.enterLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith(
            "nonexistent request"
          );
        });

        // This test is too big...
        // This test simulates users entering the lottery and wraps the entire functionality of the lottery
        // inside a promise that will resolve if everything is successful.
        // An event listener for the WinnerPicked is set up
        // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
        // All the assertions are done once the WinnerPicked event is fired
        it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3; // to test
          const startingIndex = 1;
          let startingBalance;
          const accounts = await ethers.getSigners();
          for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
            const lotteryInstance = lottery.connect(accounts[i]); // Returns a new instance of the Lottery contract connected to player
            await lotteryInstance.enterLottery({ value: entranceFee });
          }
          const startingTimeStamp = await lottery.getLastTimeStamp(); // stores starting timestamp (before we fire our event)

          // This will be more important for our staging tests...
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              // event listener for WinnerPicked
              // console.log("WinnerPicked event fired!");
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event if it fails.
              try {
                // Now lets get the ending values...
                const recentWinner = await lottery.getRecentWinner();
                const lotteryState = await lottery.getLotteryState();
                const winnerBalance = await accounts[1].getBalance();
                const endingTimeStamp = await lottery.getLastTimeStamp();
                await expect(lottery.getPlayer(0)).to.be.reverted;
                // Comparisons to check if our ending values are correct:
                assert.equal(recentWinner, accounts[1].address);
                assert.equal(lotteryState, 0);
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance.add(entranceFee.mul(additionalEntrances).add(entranceFee)).toString()
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve(); // if try passes, resolves the promise
              } catch (e) {
                reject(e); // if try fails, rejects the promise
              }
            });

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            try {
              const txResponse = await lottery.performUpkeep([]);
              const txReceipt = await txResponse.wait(1);
              startingBalance = await accounts[1].getBalance();
              await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, lottery.address);
            } catch (e) {
              reject(e);
            }
          });
        });
      });
    });
