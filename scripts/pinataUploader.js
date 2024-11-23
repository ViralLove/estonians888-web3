const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Ваши API-ключи Pinata
const API_KEY = 'd676bfa8664992ff8d8e';
const API_SECRET = '222f34bde931ce2aae694cc675b912a008029b69f7d1b6176aefc120ffa104da';

// Путь к папке output относительно текущего скрипта
const OUTPUTS_DIR = path.join(__dirname, 'output');

/**
 * Загружает файл в Pinata
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<void>}
 */
async function uploadToPinata(filePath) {
    try {
        const fileName = path.basename(filePath);
        const inviteCode = fileName.replace('.png', ''); // Получаем код из имени файла
        const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: fileName,
            contentType: 'image/png'
        });

        const response = await axios.post(url, formData, {
            headers: {
                ...formData.getHeaders(),
                'pinata_api_key': API_KEY,
                'pinata_secret_api_key': API_SECRET,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Выводим строку в нужном формате
        console.log(`{ code: "${inviteCode}", uri: "https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}" },`);
        return response.data.IpfsHash;
    } catch (error) {
        console.error(`Ошибка при загрузке файла ${filePath}:`, error.response?.data || error.message);
        return null;
    }
}

// Пропускаем системные файлы
function isValidFile(fileName) {
    return !fileName.startsWith('.') && fileName.endsWith('.png');
}

/**
 * Загружает все файлы из папки outputs в Pinata
 */
async function uploadAllFiles() {
    try {
        if (!fs.existsSync(OUTPUTS_DIR)) {
            console.error(`Папка ${OUTPUTS_DIR} не найдена!`);
            return;
        }

        const files = fs.readdirSync(OUTPUTS_DIR)
            .filter(isValidFile)
            .map(file => path.join(OUTPUTS_DIR, file));

        if (files.length === 0) {
            console.log('Нет файлов для загрузки.');
            return;
        }

        console.log(`Найдено ${files.length} файлов для загрузки.`);
        
        for (const filePath of files) {
            await uploadToPinata(filePath);
        }

        console.log('Загрузка завершена!');
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
}

// Запуск скрипта
uploadAllFiles();
