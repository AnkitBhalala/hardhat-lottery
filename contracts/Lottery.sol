// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.8;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "hardhat/console.sol";

// Errors
error Lottery__SendMoreToEnterLottery();
error Lottery__TransferFailed();
error Lottery__LotteryNotOpen();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
  // Type declarations
  enum LotteryState {
    OPEN,
    CALCULATING
  }

  // Chainlink VRF Variables
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  uint64 private immutable i_subscriptionId;
  bytes32 private immutable i_gasLane;
  uint32 private immutable i_callbackGasLimit;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  uint32 private constant NUM_WORDS = 1;

  // Lottery Variables
  uint256 private immutable i_entranceFee;
  uint256 private immutable i_interval;
  address payable[] private s_players;
  address payable s_recentWinner;
  LotteryState private s_lotteryState;
  uint256 private s_lastTimeStamp;

  event LotteryEnter(address indexed player);
  event RequestedLotteryWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed player);

  constructor(
    address vrfCoordinatorV2,
    uint entranceFee,
    bytes32 gasLane,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint256 interval
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_entranceFee = entranceFee;
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
    i_interval = interval;
    s_lotteryState = LotteryState.OPEN;
    s_lastTimeStamp = block.timestamp;
  }

  function enterLottery() public payable {
    // require(msg.value >= i_entranceFee, "Not enough value sent");
    if (msg.value < i_entranceFee) revert Lottery__SendMoreToEnterLottery();

    if (s_lotteryState != LotteryState.OPEN) revert Lottery__LotteryNotOpen();

    s_players.push(payable(msg.sender));

    // Emit an event when we update a dynamic array or mapping
    // Named events with the function name reversed
    emit LotteryEnter(msg.sender);
  }

  /**
   * @dev This is the function that the Chainlink Keeper nodes call
   * they look for `upkeepNeeded` to return True.
   * the following should be true for this to return true:
   * 1. The time interval has passed between raffle runs.
   * 2. The lottery is open.
   * 3. The contract has ETH.
   * 4. Implicity, your subscription is funded with LINK.
   */

  function checkUpkeep(
    bytes memory /* checkData */
  ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
    bool isOpen = s_lotteryState == LotteryState.OPEN;
    bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
    console.log("block.timestamp:", block.timestamp);
    console.log("s_lastTimeStamp", s_lastTimeStamp);
    console.log("i_interval:", i_interval);
    console.log("timePassed:", timePassed);
    console.log("block.timestamp - s_lastTimeStamp", (block.timestamp - s_lastTimeStamp));
    bool hasPlayers = s_players.length > 0;
    bool hasBalance = address(this).balance > 0;
    bool isUpkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    return (isUpkeepNeeded, "0x0");
  }

  /**
   * @dev Once `checkUpkeep` is returning `true`, this function is called
   * and it kicks off a Chainlink VRF call to get a random winner.
   */
  function performUpkeep(bytes calldata /* performData */) external override {
    (bool upkeepNeeded, ) = checkUpkeep("");
    console.log("performUpkeep Run ========================================================");
    if (!upkeepNeeded)
      revert Lottery__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_lotteryState));
    s_lotteryState = LotteryState.CALCULATING;
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
      i_gasLane,
      i_subscriptionId,
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );
    emit RequestedLotteryWinner(requestId);
  }

  /**
   * @dev This is the function that Chainlink VRF node
   * calls to send the money to the random winner.
   */
  function fulfillRandomWords(uint256 /* requestId */, uint256[] memory randomWords) internal override {
    uint256 winnerIndex = randomWords[0] % s_players.length;
    address payable recentWinner = s_players[winnerIndex];
    s_recentWinner = recentWinner;
    console.log("========================================================", winnerIndex);

    s_players = new address payable[](0);
    s_lastTimeStamp = block.timestamp;
    s_lotteryState = LotteryState.OPEN;

    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) revert Lottery__TransferFailed();

    emit WinnerPicked(recentWinner);
  }

  function getBlockTimeStamp() public view returns (uint256) {
    return block.timestamp;
  }

  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getPlayer(uint256 index) public view returns (address) {
    return s_players[index];
  }

  function getNumberOfPlayers() public view returns (uint256) {
    return s_players.length;
  }

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  function getLotteryState() public view returns (LotteryState) {
    return s_lotteryState;
  }

  function getLastTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  function getInterval() public view returns (uint256) {
    return i_interval;
  }

  function getRequestConfirmations() public pure returns (uint16) {
    return REQUEST_CONFIRMATIONS;
  }

  function getNumWords() public pure returns (uint32) {
    return NUM_WORDS;
  }
}
