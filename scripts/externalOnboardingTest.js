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
const CONTRACT_ABI = require("../artifacts/contracts/Estonians888InviteNFT.sol/Estonians888InviteNFT.json");

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
    console.log("\n🚀 Connecting to the Estonians888 ecosystem through the invite code...");
    console.log("Start time:", new Date().toISOString());

    try {

        // Checking environment variables before starting and creating the configuration
        const networkConfig = await checkConfiguration();
        const contractAddress = networkConfig.contractAddress;
        console.log("\n📄 Contract address:", contractAddress);

        // Creating a provider and a signer with the private key
        const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
        const realTestWallet = new ethers.Wallet(process.env.REAL_TEST_WALLET_KEY, provider);
        console.log("\n👤 Using real test wallet:", realTestWallet.address);

        // Contract JSON artifact
        const contractArtifact = require("../artifacts/contracts/Estonians888InviteNFT.sol/Estonians888InviteNFT.json");

        // Connecting to the existing contract
        const inviteNFTContract = new ethers.Contract(
            contractAddress, // Contract address
            contractArtifact.abi,  // ABI of the contract
            realTestWallet // The wallet is used as a provider/signer
        );

        console.log("📄 Connected to contract:", inviteNFTContract.target);

        // obtain invite code from the script arguments

        onboardingData.wallet = {
            address: realTestWallet.address,
            privateKey: process.env.REAL_TEST_WALLET_KEY,
            email: process.env.YOUR_EMAIL
        };

        // Extracting invide code from the .env.local
        onboardingData.inviteCode = process.env.INVITE_CODE;

        // Verifying the new wallet
        await verifyWallet(realTestWallet, inviteNFTContract);

        // Validating if invite code is available
        console.log("\n Validating if invite code ", onboardingData.inviteCode, " is available...");
        const isValid = await inviteNFTContract.validateInviteCode(onboardingData.inviteCode);

        // Put a warning message and stop script execution if the invite code is not valid
        if (!isValid) {
            console.warn("\n❌ The invite code is not valid");
            process.exit(1);
        }

        // Activating the invite code in the contract with the onboarding email
        console.log("\n🔍 Activating the invite code in the contract with the onboarding email:", onboardingData.wallet.email);
        const activateInviteTx = await inviteNFTContract.connect(realTestWallet).activateInvite(
            onboardingData.inviteCode, 
            onboardingData.wallet.email
        );

        console.log("📤 Transaction hash:", activateInviteTx.hash);
        await activateInviteTx.wait();
        console.log("✅ Now the invite code is activated");

        // Linking the onboardingWallet to the email
        console.log("\n🔗 Linking the wallet [", onboardingWallet.wallet.address, "] to the invite code [", onboardingData.inviteCode, "]");
        const wallet2EmailTxn = await inviteNFTContract.connect(deployer).connectWallet(
            onboardingData.wallet.email,
            onboardingData.wallet.address
        );

        console.log("📤 Transaction hash:", wallet2EmailTxn.hash);
        await wallet2EmailTxn.wait();

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
        console.log("- Number of invites:", friendsInviteCodes.length);
        console.log("\nInvite codes:", friendsInviteCodes);
        console.log("\nMetadata URIs:", friendsInviteURIs);

        // Checking if arrays have the same length
        if (friendsInviteCodes.length !== friendsInviteURIs.length) {
            throw new Error(`Mismatch in arrays length: codes=${friendsInviteCodes.length}, URIs=${friendsInviteURIs.length}`);
        }
        
        console.log("friendsInviteCodes: ", friendsInviteCodes);
        const friendsInvitesMintTxn = await createInviteNFTs(inviteNFTContract, onboardingData.wallet.address, friendsInviteCodes, friendsInviteURIs);
        console.log("📤 Transaction hash:", friendsInvitesMintTxn.hash);
        console.log("Minted NFT addresses: ", friendsInvitesMintTxn.receipt.logs.map(log => log.args.to));

        // After creating friend invites
        onboardingData.friendInvites = {
            codes: friendsInviteCodes,
            imageUrls: friendsInviteURIs,
            txHashes: [friendsInvitesMintTxn.hash]
        };

        const receipt = friendsInvitesMintTxn.receipt;
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
        console.log("Wallet:", onboardingData.wallet.address);
        console.log("Invite code:", onboardingData.inviteCode);
        console.log("Friend invites:", onboardingData.friendInvites);

    } catch (error) {
        console.error("Message:", error.message);
        if (error.data) {
            try {
                const decodedError = ethers.toUtf8String('0x' + error.data.slice(138));
                console.error("Contract message:", decodedError);
            } catch (e) {
                console.error("Error data:", error.data);
            }
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


async function verifyWallet(wallet, inviteNFTContract) {
    console.log("\n🔐 Verifying the new wallet");
    
    try {

        // Getting the current nonce directly from the network
        const expectedNonce = await wallet.provider.getTransactionCount(wallet.address, "latest");
        console.log("Expected nonce from provider:", expectedNonce);
        

        // Creating a message for signing
        const message = "Verify wallet for Estonians888InviteNFT";
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(
                ["string", "address"],
                [message, wallet.address]
            )
        );

        // Signing the message
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));
        
        console.log("📝 Verification details:");
        console.log("- Original message:", message);
        console.log("- Address:", wallet.address);
        console.log("- Message hash:", messageHash);
        console.log("- Signature:", signature);

        // Verifying the wallet in the contract
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

        // Оцениваем гз с правиьными параметрами
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
        await new Promise(resolve => setTimeout(resolve, 10000));
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
            receipt: receipt,
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

