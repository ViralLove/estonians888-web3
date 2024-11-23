require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { ethers } = require("ethers");

module.exports = {
    solidity: {
        version: "0.8.18",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        amoy: {
            url: process.env.POLYGON_AMOY_RPC_URL,
            accounts: [process.env.DEPLOYER_PRIVATE_KEY],
            gasPrice: 30000000000,
            gasLimit: 5000000
        },
    }
};
