const { ethers } = require("hardhat");
const dotenv = require('dotenv');

// Загружаем конфигурацию
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
    const network = process.env.NETWORK || 'local';
    console.log(`\n🌍 Деплой в сеть: ${network}`);

    const [deployer] = await ethers.getSigners();
    console.log("👤 Deploying contracts with account:", deployer.address);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance));

    // Деплоим контракт
    const InviteNFT = await ethers.getContractFactory("Estonians888InviteNFT");
    console.log("\n📄 Deploying Estonians888InviteNFT...");
    
    const inviteNFT = await InviteNFT.deploy();
    await inviteNFT.waitForDeployment();
    
    const contractAddress = await inviteNFT.getAddress();
    console.log("✅ Estonians888InviteNFT deployed to:", contractAddress);

    // Сохраняем адрес в конфигурацию
    if (network === 'local') {
        process.env.LOCAL_INVITE_NFT_CONTRACT = contractAddress;
    } else if (network === 'polygon_amoy') {
        process.env.POLYGON_INVITE_NFT_CONTRACT = contractAddress;
    }

    console.log("\n📝 Deployment Summary:");
    console.log("- Network:", network);
    console.log("- Contract Address:", contractAddress);
    console.log("- Deployer Address:", deployer.address);
    console.log("- Remaining Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // Верификация параметров
    console.log("\n🔍 Проверка параметров контракта...");
    const deployedContract = await ethers.getContractAt("Estonians888InviteNFT", contractAddress);
    const name = await deployedContract.name();
    const symbol = await deployedContract.symbol();
    
    console.log("- Name:", name);
    console.log("- Symbol:", symbol);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error during deployment:");
        console.error(error);
        process.exit(1);
    });
