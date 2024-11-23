const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Получаем баланс через provider
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Развертывание контрактов с аккаунта:", deployer.address);
    console.log("Баланс аккаунта:", ethers.formatEther(balance), "ETH");

    // Деплой Estonians888InviteNFT
    const Estonians888InviteNFT = await ethers.getContractFactory("Estonians888InviteNFT");
    
    // Кошелек с ненулевым балансом который становится владельцем контракта
    const estonians888NFTAddress = "0x62836D3c48751940E18Ec199844B4ED408969AE5"; 
    
    const estonians888InviteNFT = await Estonians888InviteNFT.deploy(estonians888NFTAddress);
    await estonians888InviteNFT.waitForDeployment();

    console.log("Estonians888InviteNFT развернут по адресу:", await estonians888InviteNFT.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
