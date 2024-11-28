require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL,
      accounts: [process.env.POLYGON_DEPLOYER_KEY].filter(Boolean)
    }
  }
};

if (!process.env.LOCAL_DEPLOYER_KEY) {
  console.warn("⚠️ LOCAL_DEPLOYER_KEY не найден в переменных окружения");
}

if (!process.env.POLYGON_DEPLOYER_KEY) {
  console.warn("⚠️ POLYGON_DEPLOYER_KEY не найден в переменных окружения");
}
