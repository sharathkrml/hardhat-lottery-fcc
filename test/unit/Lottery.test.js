const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

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
                  const { upkeepNeeded } = await Lottery.callStatic.checkUpkeep([]) //don't send transaction,just simulate
                  assert(!upkeepNeeded)
              })
              it("returns false if Lottery isn't open", async () => {
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
                      "Lottery_UpkeepNotNeeded"
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
          describe("fulfillRandomWords", () => {
              beforeEach(async () => {
                  await Lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpKeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, Lottery.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, Lottery.address)
                  ).to.be.revertedWith("nonexistent request")
                  //   fuzz testing in future
              })
              //   Massive Promise test
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3 // to test
                  const startingIndex = 2
                  let accounts = await ethers.getSigners()
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      await Lottery.connect(accounts[i]).enterLottery({
                          value: entranceFee,
                      }) // Returns a new instance of the Lottery contract connected to player
                  }
                  const startingTimeStamp = await Lottery.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      Lottery.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!")
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await Lottery.getRecentWinner()
                              const LotteryState = await Lottery.getLotteryState()
                              const winnerBalance = await accounts[2].getBalance()
                              const endingTimeStamp = await Lottery.getLastTimeStamp()
                              await expect(Lottery.getPlayer(0)).to.be.reverted
                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(LotteryState, 0)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance // startingBalance + ( (LotteryEntranceFee * additionalEntrances) + LotteryEntranceFee )
                                      .add(entranceFee.mul(additionalEntrances).add(entranceFee))
                                      .toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve() // if try passes, resolves the promise
                          } catch (e) {
                              reject(e) // if try fails, rejects the promise
                          }
                      })

                      const tx = await Lottery.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[2].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          Lottery.address
                      )
                  })
              })
          })
      })
