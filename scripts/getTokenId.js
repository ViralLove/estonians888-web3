const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const contractAddress = process.env.AMOY_INVITE_CONTRACT;
    const Estonians888InviteNFT = await hre.ethers.getContractFactory("Estonians888InviteNFT");
    const contract = await Estonians888InviteNFT.attach(contractAddress);

    // Получить баланс (количество NFT)
    const balance = await contract.balanceOf(deployer.address);
    console.log("Количество NFT:", balance.toString());
    console.log("Адрес контракта:", contractAddress);
    console.log("\nДанные для импорта в MetaMask:");
    console.log("--------------------------------");

    // Получить tokenId для каждого NFT
    for(let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(deployer.address, i);
        console.log(`\nNFT #${i}:`);
        console.log(`Contract Address: ${contractAddress}`);
        console.log(`Token ID: ${tokenId.toString()}`);
        console.log("--------------------------------");
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });