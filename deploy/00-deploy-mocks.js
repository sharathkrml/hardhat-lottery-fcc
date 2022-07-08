const { network, ethers } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25")
const GAS_PRICE_LINK = 1e9
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    if (developmentChains.includes(network.name)) {
        log("local network detected,deploying mocks!!")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("MOCKS DEPLOYED!!")
        log("--------------------")
    }
}
module.exports.tags = ["all", "mocks"]
