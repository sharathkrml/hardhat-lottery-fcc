const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", () => {
          let Lottery, vrfCoordinatorV2Mock, entranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              Lottery = await ethers.getContract("Lottery", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              entranceFee = await Lottery.getEntranceFee()
              interval = await Lottery.getInterval()
          })
          describe("constructor", () => {
              it("initializes Lottery Correctly", async () => {
                  const LotteryState = await Lottery.getLotteryState()
                  assert.equal(LotteryState.toString(), "0")
                  const Interval = await Lottery.getInterval()
                  assert.equal(Interval.toString(), networkConfig[chainId]["interval"])
              })
          })
          describe("enterLottery", () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(Lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughEthEntered"
                  )
              })
              it("records player when they enter", async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  const playerFromContract = await Lottery.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async () => {
                  //   from ethereum waffle
                  await expect(Lottery.enterLottery({ value: entranceFee })).to.emit(
                      Lottery,
                      "LotteryEnter"
                  )
              })
              it("doesn't allow entrance when Lottery is calculating", async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //   pretend tto be chainlink keeper
                  await Lottery.performUpkeep([])
                  await expect(Lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
                      "Lottery__NotOpen"
                  )
              })
          })
          describe("checkUpKeep", () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // time travel!!!
                  await network.provider.send("evm_mine", [])
                  await Lottery.performUpkeep("0x")
                  const LotteryState = await Lottery.getLotteryState()
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([])
                  assert.equal(LotteryState.toString(), "1")
                  assert(!upkeepNeeded)
              })
          })
          describe("performUpKeep", () => {
              it("only run if checkUpKeep true", async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // time travel!!!
                  await network.provider.send("evm_mine", [])
                  const tx = await Lottery.performUpkeep([])
                  assert(tx)
              })
              it("reverts if checkupkeep is false", async () => {
                  await expect(Lottery.performUpkeep([])).to.be.revertedWith(
                      "Raffle_UpkeepNotNeeded"
                  )
              })
              it("updated Lottery State,emits an event,& calls vrfcoordinator", async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // time travel!!!
                  await network.provider.send("evm_mine", [])
                  const txnRes = await Lottery.performUpkeep([])
                  const txnReceipt = await txnRes.wait(1)
                  const requestId = txnReceipt.events[1].args.requestId
                  const lotteryState = await Lottery.getLotteryState()
                  assert(requestId.toNumber() > 0)
                  assert(lotteryState == 1)
              })
          })
      })
