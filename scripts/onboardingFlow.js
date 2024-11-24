const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');
const hre = require("hardhat");
const { ethers } = require("ethers");

// Функция генерации инвайт-кода
function generateInviteCode() {
    const randomDigit = () => Math.floor(Math.random() * 9) + 1;
    const code = `VL888-${randomDigit()}${randomDigit()}${randomDigit()}-${randomDigit()}${randomDigit()}${randomDigit()}`;
    
    console.log("\n🔍 Проверка формата кода:");
    console.log("Сгенерированный код:", code);
    console.log("Длина:", code.length, "символов");
    
    return code;
}

// Функция создания изображения
async function createInviteImage(code) {
    console.log("\n🎨 Создание изображения для инвайт-кода...");
    
    const templatePath = path.join(__dirname, 'InviteNFT-back.png');
    const outputDir = path.join(__dirname, 'temp');
    const outputPath = path.join(outputDir, `${code}.png`);

    if (!fs.existsSync(outputDir)) {
        console.log("📁 Создание временной директории...");
        fs.mkdirSync(outputDir);
    }

    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    console.log("🖼️ Загрузка шаблона...");
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

    console.log("✅ Изображение создано:", outputPath);
    return outputPath;
}

// Функция загрузки в Pinata
async function uploadToPinata(filePath) {
    console.log("\n📤 Загрузка изображения в Pinata IPFS...");
    
    const API_KEY = 'd676bfa8664992ff8d8e';
    const API_SECRET = '222f34bde931ce2aae694cc675b912a008029b69f7d1b6176aefc120ffa104da';

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

        console.log("✅ Файл успешно загружен в IPFS");
        console.log("IPFS Hash:", response.data.IpfsHash);
        return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } catch (error) {
        console.error("❌ Ошибка загрузки в Pinata:", error.response?.data || error.message);
        throw error;
    }
}

async function main() {
    console.log("\n🚀 Запуск процесса онбординга в сети Amoy");
    console.log("Время запуска:", new Date().toISOString());

    try {
        const [deployer] = await hre.ethers.getSigners();
        console.log("\n👤 Используется аккаунт:", deployer.address);

        const contractAddress = process.env.AMOY_INVITE_CONTRACT;
        if (!contractAddress) {
            throw new Error("Не указан адрес контракта в AMOY_INVITE_CONTRACT");
        }

        const InviteNFT = await hre.ethers.getContractFactory("Estonians888InviteNFT");
        const inviteNFT = InviteNFT.attach(contractAddress);
        console.log("📄 Подключен к контракту:", inviteNFT.target);

        // Шаг 1: Генерация инвайт-кода и создание NFT
        console.log("\n🎯 Шаг 1: Создание инвайта и изображения");
        
        // Генерация кода
        const inviteCode = generateInviteCode();
        console.log("🎫 Сгенерирован код:", inviteCode);
        
        // Создание изображения
        let imagePath;
        try {
            imagePath = await createInviteImage(inviteCode);
            
            // Проверяем создание файла
            if (!fs.existsSync(imagePath)) {
                throw new Error("Файл изображения не создан");
            }
            
            const fileStats = fs.statSync(imagePath);
            console.log("\n📸 Изображение создано:");
            console.log("- Путь:", imagePath);
            console.log("- Разм��:", (fileStats.size / 1024).toFixed(2), "KB");
            console.log("- Создано:", fileStats.birthtime);
        } catch (error) {
            console.error("❌ Ошибка при создании изображения:");
            console.error(error.message);
            throw error;
        }

        // После успешной загрузки в IPFS
        console.log("\n📤 Загрузка в Pinata IPFS...");
        console.log("\n📤 Загрузка изображения в Pinata IPFS...");
        
        let ipfsHash;
        try {
            const pinataResponse = await uploadToPinata(imagePath);
            ipfsHash = pinataResponse.IpfsHash;
            console.log("✅ Файл успешно загружен в IPFS");
            console.log("IPFS Hash:", ipfsHash);
        } catch (error) {
            console.error("❌ Ошибка загрузки в IPFS:");
            console.error(error);
            throw error;
        }

        // Очистка временных файлов
        try {
            if (imagePath && fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log("\n🧹 Временный файл очищен:", imagePath);
            }
        } catch (error) {
            console.warn("⚠️ Ошибка при очистке временных файлов:", error.message);
        }

        // Временный URI для теста
        const tempTokenUri = "ipfs://your-token-uri";

        // Создаем инвайт
        console.log("\n⏳ Отправка транзакции...");
        const tx = await inviteNFT.mintInvite(
            deployer.address, 
            inviteCode, 
            tempTokenUri
        );
        console.log("🔄 Ожидание подтверждения транзакции...");
        const receipt = await tx.wait();
        
        // Получаем tokenId из событий транзакции
        const transferEvent = receipt.logs[0]; // Первое событие всегда Transfer при минтинге
        const tokenId = parseInt(transferEvent.topics[3], 16); // TokenId находится в третьем топике
        
        // Получаем стоимость газа в POL
        const gasPrice = receipt.gasPrice;
        const gasCostWei = gasPrice * receipt.gasUsed;
        const gasCostPOL = ethers.formatEther(gasCostWei);

        console.log("\n✅ Создан новый инвайт:");
        console.log("Код:", inviteCode);
        console.log("Token ID:", tokenId);
        console.log("Tx Hash:", receipt.hash);
        console.log("Block:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Стоимость газа:", gasCostPOL, "POL");
        console.log("🖼️ Изображение:", `https://gateway.pinata.cloud/ipfs/${ipfsHash}`);

        // Добавим дополнительные проверки перед верификацией
        console.log("\n🔐 Шаг 2: Верификация кошелька");
        try {
            // Создаем тестовый кошелек
            const testWallet = ethers.Wallet.createRandom();
            console.log("\n✨ Создан тестовый кошелек:");
            console.log("📫 Адрес:", testWallet.address);
            console.log("🔑 Приватный ключ:", testWallet.privateKey);
            
            // Создаем сообщение в точности как в контракте
            const VERIFICATION_MESSAGE = "Verify wallet for Estonians888InviteNFT";
            
            // Формируем сообщение как в контракте
            const messageHash = ethers.keccak256(
                ethers.solidityPacked(
                    ["string", "address"],
                    [VERIFICATION_MESSAGE, testWallet.address]
                )
            );
            
            console.log("\n📝 Подготовка подписи");
            console.log("Сообщение:", VERIFICATION_MESSAGE);
            console.log("Адрес для подписи:", testWallet.address);
            console.log("Хэш для подписи:", messageHash);
            
            // Подписываем сообщение
            const signature = await testWallet.signMessage(
                ethers.getBytes(messageHash)
            );
            console.log("\n✍️ Подпись получена:", signature);
            console.log("Длина подписи:", signature.length, "байт");
            
            // Верифицируем кошелек через контракт
            console.log("\n🔍 Верификация кошелька в контракте");
            console.log("Отправляем транзакцию verifyWallet с параметрами:");
            console.log("- wallet:", testWallet.address);
            console.log("- signature:", signature);
            
            const verifyTx = await inviteNFT.verifyWallet(testWallet.address, signature);
            console.log("\n⏳ Ожидание подтверждения транзакции верификации...");
            const verifyReceipt = await verifyTx.wait();
            
            console.log("\n✅ Транзакция верификации выполнена:");
            console.log("Tx Hash:", verifyReceipt.hash);
            console.log("Block:", verifyReceipt.blockNumber);
            console.log("Gas Used:", verifyReceipt.gasUsed.toString());
            
            // Проверяем результат
            const isVerified = await inviteNFT.isWalletVerified(testWallet.address);
            console.log("\n🔍 Проверка статуса верификации:");
            console.log("Верифицирован:", isVerified ? "✅ Да" : "❌ Нет");

        } catch (error) {
            console.error("\n❌ Ошибка в процессе верификации:");
            console.error("Тип ошибки:", error.constructor.name);
            console.error("Сообщение:", error.message);
            if (error.data) {
                console.error("Данные ошибки:", error.data);
            }
            if (error.transaction) {
                console.error("Транзакция:", error.transaction);
            }
            throw error;
        }

        console.log("\n✨ Процесс онбординга успешно завершен");
    } catch (error) {
        console.error("\n❌ Произошла ошибка во время выполнения:");
        console.error("Сообщение:", error.message);
        if (error.data) {
            try {
                const decodedError = ethers.toUtf8String('0x' + error.data.slice(138));
                console.error("Сообщение контракта:", decodedError);
            } catch (e) {
                console.error("Данные ошибки:", error.data);
            }
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
