// Import contracts
const Estonians888Token = artifacts.require("Estonians888Token");
const LoveDoPostNFT = artifacts.require("LoveDoPostNFT");

module.exports = async function (deployer, network, accounts) {
    // Deploy Estonians888Token, allocating initial supply to contract
    await deployer.deploy(Estonians888Token);
    const estonians888Token = await Estonians888Token.deployed();

    // Deploy LoveDoPostNFT, passing the address of Estonians888Token as the constructor argument
    await deployer.deploy(LoveDoPostNFT, estonians888Token.address);
    const loveDoPostNFT = await LoveDoPostNFT.deployed();
    
    console.log("Estonians888Token deployed at:", estonians888Token.address);
    console.log("LoveDoPostNFT deployed at:", loveDoPostNFT.address);
};
