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

        // Updating the verification status of the deployer's wallet
        const isVerified = await inviteNFTContract.isWalletVerified(deployer.address)
            .catch(error => {
                console.error("\n❌ Error checking verification status:");
                console.error("- Message:", error.message);
                if (error.data) {
                    try {
                        const decodedError = ethers.toUtf8String('0x' + error.data.slice(138));
                        console.error("- Error message:", decodedError);
                    } catch (e) {
                        console.error("- Error data:", error.data);
                    }
                }
                return false;
            });
        
        // Waiting for the verification
        await new Promise(resolve => setTimeout(resolve, 10000));
        if (!isVerified) {
                console.log("\n🔐 Verifying the deployer's wallet...");
            try {
                const message = "Verify wallet for Estonians888InviteNFT";
                const messageHash = ethers.keccak256(
                    ethers.solidityPacked(
                        ["string", "address"],
                        [message, deployer.address]
                    )
                );
                
                console.log("\n📝 Verification details:");
                console.log("- Address:", deployer.address);
                console.log("- Message:", message);
                console.log("- Message hash:", messageHash);
                
                const signature = await deployer.signMessage(ethers.getBytes(messageHash));
                console.log("- Signature:", signature);
                
                console.log("\n⏳ Sending the verification transaction...");
                const verifyTx = await inviteNFTContract.verifyWallet(deployer.address, signature);
                
                console.log("📄 Transaction hash:", verifyTx.hash);
                console.log("⏳ Waiting for the transaction confirmation...");
                
                const receipt = await verifyTx.wait();
                console.log("\n✅ The deployer's wallet is successfully verified");
                console.log("- Gas used:", receipt.gasUsed.toString());
                if (receipt.effectiveGasPrice) {
                    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
                    console.log("- Transaction cost:", ethers.formatEther(gasCost), "ETH");
                }
            } catch (error) {
                console.error("\n❌ Error verifying the wallet:");
                console.error("- Message:", error.message);
                if (error.data) {
                    try {
                        const decodedError = ethers.toUtf8String('0x' + error.data.slice(138));
                        console.error("- Contract message:", decodedError);
                    } catch (e) {
                        console.error("- Error data:", error.data);
                    }
                }
                throw error;
            }
        } else {
            console.log("\n✅ The deployer's wallet is already verified");
        }
        
        const deployerInviteNFTData = await createDeployerInviteNFT({
            deployer: deployer,  // deployer wallet from the previous code
            configObject: networkConfig  // network configuration
        });
        console.log("\n🎫 Deployer invite NFT data:", deployerInviteNFTData);
        console.log("\n💰 Deployer:", deployer);
        const onboardingWallet = await generateTestWallet(deployer);
        console.log("\n👤 Onboarding wallet:", onboardingWallet.address);

        // Verifying the new wallet
        await verifyWallet(onboardingWallet, inviteNFTContract);

        // Waiting for the verification
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Getting the current nonce for validating the code
        const validateNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
        console.log("\n📊 Current deployer nonce for validation:", validateNonce);

        // Validating if invite code is available
        console.log("\n Validating if invite code is available...");
        const isValid = await inviteNFTContract.validateInviteCode(
            deployerInviteNFTData.inviteCode,
            {
                nonce: validateNonce,
                gasLimit: ethers.parseUnits("300000", "wei")
            }
        );

        onboardingData.rootInvite = {
            code: deployerInviteNFTData.inviteCode,
            imageIpfs: deployerInviteNFTData.metadata.image,
            txHash: isValid.txHash,
            tokenId: isValid.tokenId
        };

        // Waiting for the invite code validation
        await new Promise(resolve => setTimeout(resolve, 10000));

        if (!isValid) throw new Error("This invite code is not available");
        console.log("✅ This invite code is available");

        // Getting the current nonce for deployer
        const deployerNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
        console.log("\n📊 Current deployer nonce:", deployerNonce);

        // Activating the invite code in the contract with the onboarding email
        console.log("\n🔍 Activating the invite code in the contract with the onboarding email:", deployerInviteNFTData.email);
        const activateInviteTx = await inviteNFTContract.connect(deployer).activateInvite(
            deployerInviteNFTData.inviteCode, 
            deployerInviteNFTData.email,
            {
                nonce: deployerNonce,
                gasLimit: ethers.parseUnits("300000", "wei")
            }
        );

        // Waiting for the invite code activation
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log("📤 Transaction hash:", activateInviteTx.hash);
        await activateInviteTx.wait();
        console.log("✅ Now the invite code is activated");

        // Getting the updated nonce for the next transaction
        const updatedNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
        console.log("\n📊 Current deployer nonce for wallet linking:", updatedNonce);

        // Linking the onboardingWallet to the email
        console.log("\n🔗 Linking the wallet [", onboardingWallet.address, "] to the invite code [", deployerInviteNFTData.inviteCode, "]");
        const wallet2EmailTxn = await inviteNFTContract.connect(deployer).connectWallet(
            deployerInviteNFTData.email,
            onboardingWallet.address,
            {
                nonce: updatedNonce,
                gasLimit: ethers.parseUnits("300000", "wei")
            }
        );

        // Waiting for the wallet linking
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log("📤 Transaction hash:", wallet2EmailTxn.hash);
        await wallet2EmailTxn.wait();

        // После создания onboarding wallet
        onboardingData.onboardingWallet = {
            address: onboardingWallet.address,
            privateKey: onboardingWallet.privateKey
        };
        console.log("✅ The wallet is successfully linked to the invite code");

        // Minting INVITES_PER_USER invites for the onboardingWallet that will be given to his friends
        const friendsInviteCodes = [];
        const friendsInviteURIs = [];
        
        // Clearing arrays before using
        friendsInviteCodes.length = 0;
        friendsInviteURIs.length = 0;

        for (let i = 0; i < INVITES_PER_USER; i++) {
            const inviteNFT = await generateInviteNFTData();
            
            // Checking if the code is already added
            if (!friendsInviteCodes.includes(inviteNFT.inviteCode)) {
                friendsInviteCodes.push(inviteNFT.inviteCode);
                friendsInviteURIs.push(JSON.stringify(inviteNFT.metadata));
                console.log(`\n✅ Generated invite ${i + 1}/${INVITES_PER_USER}:`, inviteNFT.inviteCode);
            }
        }

        console.log("\n🎨 Creating invite NFTs for friends...");
        console.log("\n📝 Debug information:");
        console.log("- Recipient address:", onboardingWallet.address);
        console.log("- Number of invites:", friendsInviteCodes.length);
        console.log("\nInvite codes:", friendsInviteCodes);
        console.log("\nMetadata URIs:", friendsInviteURIs);

        // Checking if arrays have the same length
        if (friendsInviteCodes.length !== friendsInviteURIs.length) {
            throw new Error(`Mismatch in arrays length: codes=${friendsInviteCodes.length}, URIs=${friendsInviteURIs.length}`);
        }

        const invitesNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
        console.log("\n📊 Current nonce for creating friend invites:", invitesNonce);
        
        console.log("friendsInviteCodes: ", friendsInviteCodes);
        const friendsInvitesMintTxn = await createInviteNFTs(inviteNFTContract, onboardingWallet.address, friendsInviteCodes, friendsInviteURIs);

        // Waiting for the friend invites creation
        await new Promise(resolve => setTimeout(resolve, 10000));

        // After creating friend invites
        onboardingData.friendInvites.codes = friendsInviteCodes;
        onboardingData.friendInvites.imageUrls = friendsInviteURIs;
        onboardingData.friendInvites.txHashes = [friendsInvitesMintTxn.hash];

        console.log("📤 Transaction hash:", friendsInvitesMintTxn.hash);
        const receipt = await friendsInvitesMintTxn.wait();
        console.log("\n✅ Friend invites created successfully:");
        console.log("- TX Hash:", receipt.hash);
        
        if (receipt.gasUsed) {
            console.log("- Gas Used:", receipt.gasUsed.toString(), "units");
            
            if (receipt.effectiveGasPrice) {
                const gasPrice = BigInt(receipt.effectiveGasPrice);
                const gasUsed = BigInt(receipt.gasUsed);
                const totalCost = gasUsed * gasPrice;
                
                console.log("- Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
                console.log("- Total Cost:", ethers.formatEther(totalCost), "POL");
            } else {
                console.log("- Gas Price: Not available");
                console.log("- Total Cost: Not available");
            }
        } else {
            console.log("- Gas information not available");
        }

        console.log("\n✨ The onboarding process is successfully completed");

        console.log("\n🔄 Onboarding Flow Summary:");
        console.log("\n1️⃣ Initial Setup:");
        console.log("- Deployer Address:", onboardingData.initialSetup.deployerAddress);
        console.log("- Contract Address:", onboardingData.initialSetup.contractAddress);

        console.log("\n2️⃣ Root Invite NFT:");
        console.log("- Invite Code:", onboardingData.rootInvite.code);
        console.log("- Image IPFS:", onboardingData.rootInvite.imageIpfs);
        console.log("- Token ID:", onboardingData.rootInvite.tokenId || "Not available");
        console.log("- TX Hash:", onboardingData.rootInvite.txHash);

        console.log("\n3️⃣ Onboarding Wallet:");
        console.log("- Address:", onboardingData.onboardingWallet.address);
        console.log("- Private Key:", onboardingData.onboardingWallet.privateKey);

        console.log("\n4️⃣ Friend Invites:");
        console.log("- Codes:", onboardingData.friendInvites.codes);
        console.log("- Image URLs:", onboardingData.friendInvites.imageUrls);
        console.log("- TX Hashes:", onboardingData.friendInvites.txHashes);
        
    } catch (error) {
        console.error("\n❌ An error occurred during execution:");
        console.error("Message:", error.message);
        if (error.data) {
            try {
                const decodedError = ethers.toUtf8String('0x' + error.data.slice(138));
                console.error("Contract message:", decodedError);
            } catch (e) {
                console.error("Error data:", error.data);
            }
        }
        process.exit(1);
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
    
    console.log("\n Contract details:");
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

    return { inviteCode, email, metadata };
}

async function generateTestWallet(deployer) {
    const provider = hre.ethers.provider;  // Getting a provider from Hardhat
    const newWallet = ethers.Wallet.createRandom().connect(provider);
    console.log("\n💳 Preparing a new wallet");
    console.log("📫 Address:", newWallet.address);
    console.log("🔑 Private key:", newWallet.privateKey);

    // Sending POL to the new wallet
    console.log("\n💸 Sending POL to the new wallet...");
    console.log("Deployer address:", deployer.address);
    console.log("💰 Deployer balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "POL");
    const fundingTx = await deployer.sendTransaction({
        to: newWallet.address,
        value: ethers.parseEther("0.888")
    });
    await fundingTx.wait();
    console.log("✅ Sent 0.888 ETH to", newWallet.address);

    // Checking the balance
    const balance = await provider.getBalance(newWallet.address);
    console.log("💰 Balance of the new wallet:", ethers.formatEther(balance), "POL");

    return newWallet;
}

async function verifyWallet(wallet, inviteNFTContract) {
    console.log("\n🔐 Verifying the new wallet");
    
    try {
        // Getting the current nonce directly from the network
        const expectedNonce = await wallet.provider.getTransactionCount(wallet.address, "latest");
        console.log("Expected nonce from provider:", expectedNonce);
        
        const message = "Verify wallet for Estonians888InviteNFT";
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(
                ["string", "address"],
                [message, wallet.address]
            )
        );
        
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));
        
        console.log("📝 Verification details:");
        console.log("- Original message:", message);
        console.log("- Address:", wallet.address);
        console.log("- Message hash:", messageHash);
        console.log("- Signature:", signature);

        // Adding additional checks and waiting
        const verifyTx = await inviteNFTContract.connect(wallet).verifyWallet(
            wallet.address, 
            signature,
            { 
                nonce: expectedNonce,
                gasLimit: ethers.parseUnits("300000", "wei"),
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("1", "gwei")
            }
        );
        
        
        console.log("\n⏳ Waiting for verification transaction...");
        console.log("Transaction hash:", verifyTx.hash);
        
        const verifyReceipt = await verifyTx.wait();
        console.log("✅ Wallet verified successfully");

        // Safely getting values with checks
        if (verifyReceipt && verifyReceipt.gasUsed && verifyReceipt.effectiveGasPrice) {
            const gasUsed = BigInt(verifyReceipt.gasUsed);
            const gasPrice = BigInt(verifyReceipt.effectiveGasPrice);
            const gasCost = gasUsed * gasPrice;
            console.log("💰 Verification cost:", ethers.formatEther(gasCost), "POL");
        } else {
            console.log("💰 Verification completed (cost calculation unavailable)");
        }

        return verifyReceipt;
    } catch (error) {
        console.error("\n❌ Verification failed:", error.message);
        if (error.data) {
            console.error("Contract error data:", error.data);
        }
        throw error;
    }
}

async function createInviteNFTs(contract, recipientAddress, inviteCodes, metadataURIs) {
    console.log("\n📦 Creating invite NFTs...");
    console.log("inviteCodes: ", inviteCodes);
    
    try {

        // Оцениваем газ с правильными параметрами
        const gasEstimate = await contract.createInviteNFTs.estimateGas(
            recipientAddress,
            inviteCodes,
            metadataURIs,
            {
                from: await contract.runner.getAddress()
            }
        );

        // Преобразуем в BigInt и добавляем 30% запаса
        const gasLimit = (BigInt(gasEstimate) * BigInt(130)) / BigInt(100);
        
        // Creating invite NFTs
        const tx = await contract.createInviteNFTs(
            recipientAddress,
            inviteCodes,    // Already an array
            metadataURIs,   // Array of metadata
            {
                gasLimit: gasLimit,
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
            }
        );
        
        console.log(`📤 Txn sent: ${tx.hash}`);
        
        // Waiting for the transaction confirmation
        const receipt = await tx.provider.waitForTransaction(tx.hash);
        
        // Getting gas information
        if (receipt) {
            console.log("\n💰 Transaction information:");
            console.log("- Hash:", receipt.hash);
            
            if (receipt.gasUsed) {
                console.log("- Gas used:", receipt.gasUsed.toString(), "units");
                
                if (receipt.effectiveGasPrice) {
                    const gasPrice = BigInt(receipt.effectiveGasPrice);
                    const gasUsed = BigInt(receipt.gasUsed);
                    const totalCost = gasUsed * gasPrice;
                    
                    console.log("- Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
                    console.log("- Total cost:", ethers.formatEther(totalCost), "ETH");
                }
            }
        }

        console.log(`✅ NFTs created successfully`);
        
        return {
            txHash: tx.hash,
            success: true
        };
    } catch (error) {
        console.error(`❌ Error creating NFTs:`, error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

