const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const VRF_SUB_FUND = ethers.utils.parseEther("30")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId
    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address
        const txnRes = await VRFCoordinatorV2Mock.createSubscription()
        const receipt = await txnRes.wait(1)
        subscriptionId = receipt.events[0].args.subId

        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    let entranceFee = networkConfig[chainId]["entranceFee"]
    let gasLane = networkConfig[chainId]["gasLane"]
    let callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    args = [
        entranceFee,
        vrfCoordinatorV2Address,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    const Lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_KEY) {
        log("verifying!!!!")
        await verify(Lottery.address, args)
    }
    log("-----------------------------------------")
}
module.exports.tags = ["all", "lottery"]
