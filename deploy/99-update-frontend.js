const { ethers, network } = require("hardhat")
const fs = require("fs")
const FRONTEND_ADDRESS_PATH =
    "../nextjs-smartcontract-lottery/nextjs-lottery-fcc/constants/contractAddresses.json"
const FRONTEND_ABI_PATH = "../nextjs-smartcontract-lottery/nextjs-lottery-fcc/constants/abi.json"
module.exports = async () => {
    if (process.env.UPDATE_FRONTEND) {
        console.log("updating frontend")
        const Lottery = await ethers.getContract("Lottery")
        fs.writeFileSync(FRONTEND_ABI_PATH, Lottery.interface.format(ethers.utils.FormatTypes.json))
        const contractAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESS_PATH, "utf-8"))
        if (network.config.chainId.toString() in contractAddresses) {
            if (!contractAddresses[network.config.chainId.toString()].includes(Lottery.address)) {
                contractAddresses[network.config.chainId.toString()].push(Lottery.address)
            }
        } else {
            contractAddresses[network.config.chainId.toString()] = [Lottery.address]
        }
        fs.writeFileSync(FRONTEND_ADDRESS_PATH, JSON.stringify(contractAddresses))
    }
}

module.exports.tags = ["all", "frontend"]
