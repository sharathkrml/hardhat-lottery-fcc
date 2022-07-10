require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()
const RINKEBY_URL = process.env.RINEKBY_RPC_URL || ""
const ACCOUNT = process.env.PRIVATE_KEY || ""
const ETHERSCAN = process.env.ETHERSCAN_KEY || ""
const COINMARKETCAP = process.env.COINMARKETCAP_KEY || ""
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmation: 1,
        },
        rinkeby: {
            chainId: 4,
            blockConfirmation: 6,
            url: RINKEBY_URL,
            accounts: [ACCOUNT],
        },
    },
    etherscan: {
        apiKey: {
            rinkeby: ETHERSCAN,
        },
    },
    solidity: "0.8.7",
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: true,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "INR",
        coinmarketcap: COINMARKETCAP || "",
        token: "MATIC",
    },
    mocha: {
        timeout: 500000,
    },
}
