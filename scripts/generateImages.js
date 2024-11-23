const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Генерация уникального инвайт-кода
 * @returns {string} Уникальный код в формате VL888-XXX-XXX
 */
function generateInviteCode() {
    const randomDigit = () => Math.floor(Math.random() * 9) + 1; // Генерирует числа от 1 до 9
    return `VL888-${randomDigit()}${randomDigit()}${randomDigit()}-${randomDigit()}${randomDigit()}${randomDigit()}`;
}

/**
 * Создает изображение с текстом на основе фона
 * @param {string} templatePath - Путь к шаблону (фон с сердечком)
 * @param {string} outputPath - Путь для сохранения итогового изображения
 * @param {string} code - Уникальный инвайт-код
 */
async function createInviteImage(templatePath, outputPath, code) {
    try {
        const width = 1080; // Ширина шаблона
        const height = 1920; // Высота шаблона
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Загрузка фона
        const template = await loadImage(templatePath);
        ctx.drawImage(template, 0, 0, width, height);

        // Настройка текста
        ctx.font = 'bold 60px Montserrat'; // Шрифт и размер текста
        ctx.fillStyle = '#FFFFFF'; // Цвет текста
        ctx.textAlign = 'center'; // Центровка текста

        // Координаты текста
        const textX = width / 2; // Центр по горизонтали
        const textY = height - 942; // Поднимаем текст еще на 400 пикселей выше (520 + 400 = 920)

        // Наложение текста
        ctx.fillText(code, textX, textY);

        // Сохранение результата
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        console.log(`Изображение с кодом ${code} сохранено: ${outputPath}`);
    } catch (error) {
        console.error('Ошибка при создании изображения:', error);
    }
}

/**
 * Основная функция для генерации изображений и кодов
 */
async function generateInviteImages() {
    const templatePath = path.join(__dirname, 'InviteNFT-back.png');
    const outputDir = path.join(__dirname, 'output');
    const numberOfInvites = 88;

    // Проверяем наличие файла шаблона
    if (!fs.existsSync(templatePath)) {
        console.error(`Файл шаблона не найден: ${templatePath}`);
        process.exit(1);
    }

    // Создаем папку для сохранения изображений, если она не существует
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const inviteCodes = []; // Массив для хранения кодов

    for (let i = 1; i <= numberOfInvites; i++) {
        const code = generateInviteCode(); // Генерация уникального кода
        inviteCodes.push(code); // Сохраняем код

        const outputPath = `${outputDir}/${code}.png`; // Путь для изображения
        await createInviteImage(templatePath, outputPath, code); // Генерация изображения
    }

    console.log('\nСгенерированные инвайт-коды для минтинга:');
    inviteCodes.forEach(code => {
        console.log(`{ code: "${code}", uri: "https://gateway.pinata.cloud/ipfs/IPFSHASH" },`);
    });
}

// Запуск скрипта
generateInviteImages()
    .then(() => console.log('Все изображения успешно созданы.'))
    .catch((error) => console.error('Ошибка генерации:', error));
