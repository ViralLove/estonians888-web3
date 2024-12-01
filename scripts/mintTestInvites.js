const dotenv = require('dotenv');
const { ethers } = require("hardhat");

// Loading the main .env
dotenv.config();

// Extracting variables from .env and .env.local
dotenv.config({ path: '.env.local' });

// Adding debug output
console.log("\n🔑 Checking the loading of environment variables:");
console.log("LOCAL_DEPLOYER_KEY:", process.env.LOCAL_DEPLOYER_KEY ? "✅ Loaded" : "❌ Missing");
console.log("POLYGON_DEPLOYER_KEY:", process.env.POLYGON_DEPLOYER_KEY ? "✅ Loaded" : "❌ Missing");
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const hre = require("hardhat");

const INVITES_PER_USER = 8;
const CONTRACT_NAME = "Estonians888InviteNFT";

// Create a global object to store all onboarding data
const onboardingData = {
    initialSetup: {
        deployerAddress: null,
        contractAddress: null
    },
    rootInvite: {
        code: null,
        imageIpfs: null,
        tokenId: null,
        txHash: null
    },
    onboardingWallet: {
        address: null,
        privateKey: null
    },
    friendInvites: {
        codes: [],
        imageUrls: [],
        txHashes: []
    }
};

// Function for generating an invite code
function generateInviteCode() {
    const randomDigit = () => Math.floor(Math.random() * 9) + 1;
    const code = `VL888-${randomDigit()}${randomDigit()}${randomDigit()}-${randomDigit()}${randomDigit()}${randomDigit()}`;
    
    console.log("\n🔍 Generated code:", code);
    console.log("Length:", code.length, "characters");
    
    return code;
}

// Generating an image for an invite code
async function createInviteImage(code) {
    console.log("\n🎨 Creating an image for an invite code...");
    
    const templatePath = path.join(__dirname, 'InviteNFT-back.png');
    const outputDir = path.join(__dirname, 'temp');
    const outputPath = path.join(outputDir, `${code}.png`);

    if (!fs.existsSync(outputDir)) {
        console.log("📁 Creating a temporary directory...");
        fs.mkdirSync(outputDir);
    }

    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    console.log("🖼️ Loading a template...");
    const template = await loadImage(templatePath);
    ctx.drawImage(template, 0, 0, width, height);

    ctx.font = 'bold 60px Montserrat';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    const textX = width / 2;
    const textY = height - 942;

    ctx.fillText(code, textX, textY);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log("✅ Image is created:", outputPath);
    return outputPath;
}

// Function for uploading to Pinata
async function uploadToPinata(filePath) {
    console.log("\n📤 Загрузка изображения в Pinata IPFS...");
    
    const API_KEY = process.env.PINATA_API_KEY;
    const API_SECRET = process.env.PINATA_API_SECRET;

    const formData = new FormData();
    const fileStream = fs.createReadStream(filePath);
    formData.append('file', fileStream);

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
            data: formData,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
                'pinata_api_key': API_KEY,
                'pinata_secret_api_key': API_SECRET
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        console.log("✅ File uploaded to IPFS");
        console.log("IPFS Hash:", response.data.IpfsHash);
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
        console.log("🌐 Image URL:", imageUrl);
        return imageUrl;
    } catch (error) {
        console.error("❌ Error uploading to Pinata:", error.response?.data || error.message);
        throw error;
    }
}

function createNFTMetadata(inviteCode, pinataImageUrl) {
    const metadata = {
        name: `Estonians888 Invite NFT`,
        description: `Exclusive invite code: ${inviteCode}`,
        image: pinataImageUrl,
        attributes: [
            {
                trait_type: "Invite Code",
                value: inviteCode
            },
            {
                trait_type: "Type",
                value: "Invite Pass"
            }
        ]
    };

    console.log("\n📝 Generated NFT metadata:");
    console.log(JSON.stringify(metadata, null, 2));

    return metadata;
}

/**
 * Получает конфигурацию сети на основе переменных окружения
 * @returns {Object} Объект с конфигурацией выбранной сети
 */
function getNetworkConfig() {
    const network = process.env.NETWORK || 'local';
    
    const config = {
        local: {
            rpcUrl: process.env.LOCAL_RPC_URL,
            contractAddress: process.env.LOCAL_INVITE_NFT_CONTRACT,
            deployerKey: process.env.LOCAL_DEPLOYER_KEY
        },
        polygon_amoy: {
            rpcUrl: process.env.POLYGON_AMOY_RPC_URL,
            contractAddress: process.env.POLYGON_INVITE_NFT_CONTRACT,
            deployerKey: process.env.POLYGON_DEPLOYER_KEY
        }
    };

    const networkConfig = config[network];
    if (!networkConfig) {
        throw new Error(`Unsupported network: ${network}`);
    }

    // Adding debug output
    console.log("\n🔧 Network configuration:");
    console.log("- Network:", network);
    console.log("- RPC URL:", networkConfig.rpcUrl);
    console.log("- Contract address:", networkConfig.contractAddress);
    console.log("- Deployer key:", networkConfig.deployerKey ? "✅ Set" : "❌ Missing");

    return networkConfig;
}

/**
 * Checks for the presence of all required configuration parameters
 * @throws {Error} If any required parameters are missing
 */
async function checkConfiguration() {
    const config = getNetworkConfig();
    const required = [
        { value: config.rpcUrl, name: 'RPC URL' },
        { value: config.contractAddress, name: 'Contract Address' },
        { value: config.deployerKey, name: 'Deployer Key' },
        { value: process.env.PINATA_API_KEY, name: 'Pinata API Key' },
        { value: process.env.PINATA_API_SECRET, name: 'Pinata API Secret' }
    ];

    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
        throw new Error(`Missing required parameters: ${missing.map(item => item.name).join(', ')}`);
    }

    // Проверяем валидность адреса контракта
    if (!ethers.isAddress(config.contractAddress)) {
        throw new Error(`Invalid contract address: ${config.contractAddress}`);
    }

    // Проверяем формат приватного ключа
    try {
        new ethers.Wallet(config.deployerKey);
    } catch (error) {
        throw new Error(`Invalid deployer private key`);
    }

    console.log("\n✅ Configuration checked successfully");
    console.log(`🌍 Network: ${process.env.NETWORK || 'local'}`);
    console.log(`📄 Contract address: ${config.contractAddress}`);

    return config;  // Returning the configuration
}

async function main() {
    console.log("\n🚀 Starting the onboarding process in the Estonians888 ecosystem");
    console.log("Start time:", new Date().toISOString());

    try {

        // Checking environment variables before starting and creating the configuration
        const networkConfig = await checkConfiguration();
        const contractAddress = networkConfig.contractAddress;
        console.log("\n📄 Contract address:", contractAddress);

        // Creating a provider and a signer with the private key
        const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
        const deployer = new ethers.Wallet(networkConfig.deployerKey, provider);
        console.log("\n👤 Using deployer account:", deployer.address);

        // Wait for the contract to be deployed
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Obtaining the contract
        const InviteNFT = await ethers.getContractFactory(CONTRACT_NAME, deployer);
        const inviteNFTContract = InviteNFT.attach(contractAddress);
        console.log("📄 Connected to contract:", inviteNFTContract.target);

        onboardingData.initialSetup = {
            deployerAddress: deployer.address,
            contractAddress: inviteNFTContract.target
        };

        // Создаем массив для хранения всех данных
        const allInvites = [];

        console.log("\n🔄 Minting test invites from the root wallet...");
        for (let i = 0; i < INVITES_PER_USER; i++) {
            const deployerInviteNFTData = await createDeployerInviteNFT({
                deployer: deployer,
                configObject: networkConfig
            });
            allInvites.push(deployerInviteNFTData);
        }

        // Выводим CSV заголовок и данные
        console.log("\n📋 CSV format for all minted invites:");
        console.log("Invite Code,Image URL");
        allInvites.forEach(invite => {
            console.log(`${invite.inviteCode},${invite.metadata.image}`);
        });
    } catch (error) {
        console.error("❌ Error in main:", error);
        throw error;
    }
}

async function createDeployerInviteNFT({ deployer, configObject }) {
    // Logging the input parameters of the function
    console.log("\n📝 Input parameters of createDeployerInviteNFT:");
    console.log("Deployer address:", deployer.address);
    console.log("Config object:", {
        rpcUrl: configObject.rpcUrl,
        contractAddress: configObject.contractAddress,
        // Not logging the private key for security reasons
    });

    const inviteNFTData = await generateInviteNFTData();
    
    // Getting the contract factory and connecting to the existing contract
    const InviteNFT = await ethers.getContractFactory(CONTRACT_NAME, deployer);
    const inviteNFTContract = InviteNFT.attach(configObject.contractAddress);

    // Transforming metadata to a JSON string
    const metadataString = JSON.stringify(inviteNFTData.metadata);

    console.log("\n🔨 Parameters for createInviteNFTs:");
    console.log("1. Recipient address:", deployer.address);
    console.log("2. Invite codes:", [inviteNFTData.inviteCode]);
    console.log("3. Metadata string:", metadataString);
    
    console.log("\nContract details:");
    console.log("Contract address:", inviteNFTContract.target);
    console.log("Contract name:", CONTRACT_NAME);

    console.log("\n🔨 Creating a root invite NFT...");
    
    try {
        const rootInviteTx = await inviteNFTContract.connect(deployer).createInviteNFTs(
            deployer.address,
            [inviteNFTData.inviteCode],
            [metadataString]
        );

        console.log("\n📤 Transaction sent:");
        console.log("Transaction hash:", rootInviteTx.hash);
        
        return inviteNFTData;
    } catch (error) {
        console.error("\n❌ Error in createInviteNFTs:");
        console.error("Error message:", error.message);
        if (error.data) {
            console.error("Contract error data:", error.data);
        }
        throw error;
    }
}

async function generateInviteNFTData() {

    // Step 1: Generating an invite code and placing it to an image background
    console.log("\n🎯 Step 1: Generating an invite code and placing it to an image background");
    
    // Generating an invite code...     
    const inviteCode = generateInviteCode();
    console.log("🎫 Generated code:", inviteCode);

    // Generate an email
    const email = "estonian888" + Math.ceil(Date.now() / 8) + "@estonians888.io";
    console.log("📧 Generated email:", email);
    
    // Creating an image
    let imagePath;
    try {
        imagePath = await createInviteImage(inviteCode);
        
        // Validating the image file creation
        if (!fs.existsSync(imagePath)) {
            throw new Error("Image file is not created");
        }
        
        const fileStats = fs.statSync(imagePath);
        console.log("\n📸 Image is created:");
        console.log("- Path:", imagePath);
        console.log("- Size:", (fileStats.size / 1024).toFixed(2), "KB");
        console.log("- Created:", fileStats.birthtime);
    } catch (error) {
        console.error("❌ Error creating an image:");
        console.error(error.message);
        throw error;
    }

    // Uploading to Pinata IPFS
    console.log("\n📤 Uploading an image to Pinata IPFS...");
    
    let ipfsUrl;
    try {
        ipfsUrl = await uploadToPinata(imagePath);
    } catch (error) {
        console.error("❌ Error uploading to IPFS:");
        console.error(error);
        throw error;
    }

    // Cleaning up temporary files
    try {
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log("\n🧹 Temporary file is cleaned:", imagePath);
        }
    } catch (error) {
        console.warn("️ Error cleaning up temporary files:", error.message);
    }

    // Creating a metadata for an invite code
    const metadata = createNFTMetadata(inviteCode, ipfsUrl);

    return { inviteCode, email, metadata, imageUrl: ipfsUrl };
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

