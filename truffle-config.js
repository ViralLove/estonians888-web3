module.exports = {
    networks: {
      development: {
        host: "127.0.0.1",     // Localhost (Ganache)
        port: 7545,            // Стандартный порт Ganache
        network_id: "*",       // Any network id
        gas: 6721975,
        gasPrice: 20000000000
      },
    },
    compilers: {
      solc: {
        version: "0.8.20",     // Версия компилятора Solidity
      },
    },
  };
  