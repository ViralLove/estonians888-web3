const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

describe("Estonians888InviteNFT Onboarding Flow", function () {
    let owner, user, inviteNFT, estoniansNFT, userWallet;
    let inviteCode;
    let userPrivateKey;
    let inviteTokenURI;

    function generateTestEmail() {
        const randomNum = Math.floor(10000000 + Math.random() * 90000000); // 8-значное число
        return `est888-${randomNum}@esto.io`;
    }

    const email = generateTestEmail();
    console.log("Generated test email:", email);

    function generateInviteCode() {
        const randomDigit = () => Math.floor(Math.random() * 9) + 1;
        return `VL888-${randomDigit()}${randomDigit()}${randomDigit()}-${randomDigit()}${randomDigit()}${randomDigit()}`;
    }

    async function createInviteImage(code) {
        const templatePath = path.join(__dirname, 'InviteNFT-back.png');
        const outputDir = path.join(__dirname, 'temp');
        const outputPath = path.join(outputDir, `${code}.png`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const width = 1080;
        const height = 1920;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

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

        return outputPath;
    }

    async function uploadToPinata(filePath) {
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

            console.log("Pinata response:", response.data);
            return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
        } catch (error) {
            console.error("Pinata error:", error.response?.data || error.message);
            throw error;
        }
    }

    before(async () => {
        // Генерируем новый код и создаем изображение
        inviteCode = generateInviteCode();
        console.log("Generated invite code:", inviteCode);

        const imagePath = await createInviteImage(inviteCode);
        console.log("Created invite image:", imagePath);

        inviteTokenURI = await uploadToPinata(imagePath);
        console.log("Uploaded to IPFS:", inviteTokenURI);

        // Очищаем временный файл
        fs.unlinkSync(imagePath);
        
        [owner, user] = await ethers.getSigners();

        const InviteNFT = await ethers.getContractFactory("Estonians888InviteNFT");
        inviteNFT = InviteNFT.attach(process.env.AMOY_INVITE_CONTRACT);

        console.log("Using existing contract at:", process.env.AMOY_INVITE_CONTRACT);
    });

    it("Owner mints an invite NFT", async () => {
        const tx = await inviteNFT.connect(owner).mintInvite(owner.address, inviteCode, inviteTokenURI);
        const receipt = await tx.wait();
        
        // В ethers v6 события доступны через logs и topics
        const transferLog = receipt.logs.find(
            log => log.topics[0] === inviteNFT.interface.getEvent('Transfer').topicHash
        );
        
        expect(transferLog).to.not.be.undefined;

        // Декодируем данные события
        const { from, to, tokenId } = inviteNFT.interface.decodeEventLog(
            'Transfer',
            transferLog.data,
            transferLog.topics
        );

        expect(from).to.equal(ethers.ZeroAddress);
        expect(to).to.equal(owner.address);
        expect(tokenId).to.not.be.undefined;

        // Проверяем код приглашения
        const storedCode = await inviteNFT.inviteCodes(tokenId);
        expect(storedCode).to.equal(inviteCode);

        // Сохраняем tokenId для использования в других тестах
        currentTokenId = tokenId;

        console.log(`Invite NFT minted with tokenId ${tokenId} and inviteCode ${inviteCode}`);
    });

    it("Activates the invite", async () => {
        // Проверяем начальное состояние
        let isActivated = await inviteNFT.activatedInviteCodes(inviteCode);
        expect(isActivated).to.be.false;

        // Активируем инвайт
        const tx = await inviteNFT.connect(owner).activateInvite(inviteCode, email);
        const receipt = await tx.wait();

        // Проверяем событие InviteActivated
        const activatedEvent = receipt.logs.find(
            log => log.topics[0] === inviteNFT.interface.getEvent('InviteActivated').topicHash
        );
        
        expect(activatedEvent).to.not.be.undefined;

        // Проверяем, что инвайт активирован
        isActivated = await inviteNFT.activatedInviteCodes(inviteCode);
        expect(isActivated).to.be.true;

        // Проверяем связь email с invite code
        const hashedEmail = ethers.keccak256(ethers.toUtf8Bytes(email));
        const linkedInviteCode = await inviteNFT.hashedEmailToInviteCode(hashedEmail);
        expect(linkedInviteCode).to.equal(inviteCode);

        console.log("Invite activated for email:", email);
    });

    it("Generates a wallet and verifies it", async () => {
        // Создаем новый кошелек
        const wallet = ethers.Wallet.createRandom();
        userWallet = wallet.address;
        userPrivateKey = wallet.privateKey;

        console.log("Generated wallet address:", userWallet);

        // Проверяем, что кошелек еще не верифицирован
        let isVerified = await inviteNFT.verifiedWallets(userWallet);
        expect(isVerified).to.be.false;

        // Создаем сообщение и подпись
        const message = `Verify wallet for Estonians888InviteNFT${userWallet}`;
        const messageBytes = ethers.toUtf8Bytes(message);
        const messageHash = ethers.keccak256(messageBytes);
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        // Верифицируем кошелек
        const tx = await inviteNFT.connect(owner).verifyWallet(userWallet, signature);
        const receipt = await tx.wait();

        // Проверяем событие
        const verifiedEvent = receipt.logs.find(
            log => log.topics[0] === inviteNFT.interface.getEvent('WalletVerified').topicHash
        );
        expect(verifiedEvent).to.not.be.undefined;

        // Проверяем, что ко��елек теперь верифицирован
        isVerified = await inviteNFT.verifiedWallets(userWallet);
        expect(isVerified).to.be.true;

        console.log("Wallet verified:", userWallet);
    });

    it("Connects wallet with the invite code", async () => {
        // Проверяем начальное состояние
        let connectedWallet = await inviteNFT.inviteCodeToWallet(inviteCode);
        expect(connectedWallet).to.equal(ethers.ZeroAddress);

        // Подключаем кошелек
        const tx = await inviteNFT.connect(owner).connectWallet(email, userWallet);
        const receipt = await tx.wait();

        // Проверяем событие WalletConnected
        const connectedEvent = receipt.logs.find(
            log => log.topics[0] === inviteNFT.interface.getEvent('WalletConnected').topicHash
        );
        expect(connectedEvent).to.not.be.undefined;

        // Проверяем связь invite code с кошельком
        connectedWallet = await inviteNFT.inviteCodeToWallet(inviteCode);
        expect(connectedWallet).to.equal(userWallet);

        // Проверяем связь email с кошельком
        const linkedEmail = await inviteNFT.walletToEmail(userWallet);
        expect(linkedEmail).to.equal(email);

        // Проверяем владельца NFT
        const tokenId = await inviteNFT.getTokenIdByInviteCode(inviteCode);
        const nftOwner = await inviteNFT.ownerOf(tokenId);
        expect(nftOwner).to.equal(userWallet);

        console.log("Wallet connected successfully:", userWallet);
    });

    it("Validates Invite Code correctly", async () => {
        // Проверяем валидность кода до активации
        let isValid = await inviteNFT.validateInviteCode(inviteCode);
        expect(isValid).to.be.true;

        // Активируем инвайт
        const activateTx = await inviteNFT.connect(owner).activateInvite(inviteCode, email);
        await activateTx.wait();

        // Проверяем активацию
        const isActivated = await inviteNFT.activatedInviteCodes(inviteCode);
        expect(isActivated).to.be.true;

        // Проверяем валидность кода после активации
        // Вызываем validateInviteCode и ждем результат
        isValid = await inviteNFT.validateInviteCode(inviteCode).then(result => result);
        expect(isValid).to.be.false;

        // Проверяем несуществующий код
        const fakeCode = "FAKE-CODE-999";
        isValid = await inviteNFT.validateInviteCode(fakeCode).then(result => result);
        expect(isValid).to.be.false;

        console.log("Invite code validation passed");
    });

    it("New wallet creates 8 invite NFTs", async () => {
        // Проверяем начальное состояние
        let hasCreated = await inviteNFT.hasCreatedInvites(userWallet);
        expect(hasCreated).to.be.false;

        // Создаем массив инвайт-кодов
        const inviteCodes = Array(8).fill(0).map((_, i) => 
            `VL888-${Math.floor(Math.random() * 10000)}-${Math.floor(Math.random() * 10000)}`
        );

        // Создаем инвайты
        const tx = await inviteNFT.connect(owner).createInviteNFTs(userWallet, inviteCodes);
        const receipt = await tx.wait();

        // Проверяем событие
        const createdEvent = receipt.logs.find(
            log => log.topics[0] === inviteNFT.interface.getEvent('InvitesCreated').topicHash
        );
        expect(createdEvent).to.not.be.undefined;

        // Проверяем, что инвайты созданы
        for(let i = 0; i < inviteCodes.length; i++) {
            const tokenId = await inviteNFT.getTokenIdByInviteCode(inviteCodes[i]);
            expect(tokenId).to.not.equal(0);
            
            const owner = await inviteNFT.ownerOf(tokenId);
            expect(owner).to.equal(userWallet);
            
            const storedCode = await inviteNFT.inviteCodes(tokenId);
            expect(storedCode).to.equal(inviteCodes[i]);
        }

        // Проверяем, что флаг установлен
        hasCreated = await inviteNFT.hasCreatedInvites(userWallet);
        expect(hasCreated).to.be.true;

        console.log("Successfully created 8 invite NFTs for the new wallet");
    });

});
