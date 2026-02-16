const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ЗАМЕНИ ЭТИ ДАННЫЕ НА СВОИ
const token = '8563716817:AAHqB-m3bTr2BPQWSD6RIQS93w2ea7OeDGA'; 
const chatId = '943318776';

const bot = new TelegramBot(token, { polling: false });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Путь к файлу с временными слотами
const TIME_SLOTS_FILE = path.join(__dirname, 'timeSlots.json');

// Функция для чтения временных слотов
function readTimeSlots() {
    try {
        if (fs.existsSync(TIME_SLOTS_FILE)) {
            const data = fs.readFileSync(TIME_SLOTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Ошибка чтения файла timeSlots.json:', error);
    }
    
    // Возвращаем дефолтные значения если файл не найден
    return {
        availableTimeSlots: {},
        defaultTimeSlots: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        bookedTimeSlots: {},
        discounts: {} // Новое поле для скидок: { 'дата': процент_скидки }
    };
}

// Функция для сохранения временных слотов
function saveTimeSlots(data) {
    try {
        fs.writeFileSync(TIME_SLOTS_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('✅ Временные слоты сохранены');
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        return false;
    }
}

// API: Получить доступные временные слоты
app.get('/api/time-slots', (req, res) => {
    const timeSlots = readTimeSlots();
    res.json(timeSlots);
});

// API: Получить временные слоты для конкретной даты
app.get('/api/time-slots/:date', (req, res) => {
    const { date } = req.params;
    const timeSlots = readTimeSlots();
    
    const availableSlots = timeSlots.availableTimeSlots[date] || timeSlots.defaultTimeSlots;
    const bookedSlots = timeSlots.bookedTimeSlots[date] || [];
    
    res.json({
        date: date,
        availableSlots: availableSlots,
        bookedSlots: bookedSlots
    });
});

// API: Забронировать время (делает слот недоступным)
app.post('/api/book-time', (req, res) => {
    const { date, time } = req.body;
    
    if (!date || !time) {
        return res.status(400).json({ success: false, message: 'Требуется дата и время' });
    }
    
    const timeSlots = readTimeSlots();
    
    // Инициализируем массив забронированных слотов для даты если его нет
    if (!timeSlots.bookedTimeSlots[date]) {
        timeSlots.bookedTimeSlots[date] = [];
    }
    
    // Проверяем, не забронирован ли уже этот слот
    if (timeSlots.bookedTimeSlots[date].includes(time)) {
        return res.status(400).json({ success: false, message: 'Это время уже забронировано' });
    }
    
    // Добавляем время в забронированные
    timeSlots.bookedTimeSlots[date].push(time);
    
    // Сохраняем
    if (saveTimeSlots(timeSlots)) {
        console.log(`📅 Забронировано: ${date} в ${time}`);
        res.json({ success: true, message: 'Время успешно забронировано' });
    } else {
        res.status(500).json({ success: false, message: 'Ошибка сохранения' });
    }
});

// API: Освободить время (сделать снова доступным)
app.post('/api/free-time', (req, res) => {
    const { date, time } = req.body;
    
    if (!date || !time) {
        return res.status(400).json({ success: false, message: 'Требуется дата и время' });
    }
    
    const timeSlots = readTimeSlots();
    
    if (!timeSlots.bookedTimeSlots[date]) {
        return res.status(400).json({ success: false, message: 'Нет забронированных слотов для этой даты' });
    }
    
    // Удаляем время из забронированных
    timeSlots.bookedTimeSlots[date] = timeSlots.bookedTimeSlots[date].filter(t => t !== time);
    
    // Если массив пустой, удаляем дату
    if (timeSlots.bookedTimeSlots[date].length === 0) {
        delete timeSlots.bookedTimeSlots[date];
    }
    
    // Сохраняем
    if (saveTimeSlots(timeSlots)) {
        console.log(`✅ Освобождено: ${date} в ${time}`);
        res.json({ success: true, message: 'Время освобождено' });
    } else {
        res.status(500).json({ success: false, message: 'Ошибка сохранения' });
    }
});

// API: Обновить доступные слоты для даты
app.post('/api/update-time-slots', (req, res) => {
    const { date, slots } = req.body;
    
    if (!date || !Array.isArray(slots)) {
        return res.status(400).json({ success: false, message: 'Требуется дата и массив слотов' });
    }
    
    const timeSlots = readTimeSlots();
    timeSlots.availableTimeSlots[date] = slots;
    
    if (saveTimeSlots(timeSlots)) {
        console.log(`📝 Обновлены слоты для ${date}:`, slots);
        res.json({ success: true, message: 'Слоты обновлены' });
    } else {
        res.status(500).json({ success: false, message: 'Ошибка сохранения' });
    }
});

// API: Установить скидку для даты
app.post('/api/set-discount', (req, res) => {
    const { date, discount } = req.body;
    
    if (!date || discount === undefined) {
        return res.status(400).json({ success: false, message: 'Требуется дата и процент скидки' });
    }
    
    const timeSlots = readTimeSlots();
    
    // Инициализируем объект discounts если его нет
    if (!timeSlots.discounts) {
        timeSlots.discounts = {};
    }
    
    if (discount === 0 || discount === null) {
        // Удаляем скидку
        delete timeSlots.discounts[date];
        console.log(`🗑️ Скидка удалена для ${date}`);
    } else {
        // Устанавливаем скидку
        timeSlots.discounts[date] = discount;
        console.log(`💰 Установлена скидка ${discount}% для ${date}`);
    }
    
    if (saveTimeSlots(timeSlots)) {
        res.json({ success: true, message: 'Скидка установлена' });
    } else {
        res.status(500).json({ success: false, message: 'Ошибка сохранения' });
    }
});

// API: Получить скидку для даты
app.get('/api/discount/:date', (req, res) => {
    const { date } = req.params;
    const timeSlots = readTimeSlots();
    
    const discount = (timeSlots.discounts && timeSlots.discounts[date]) || 0;
    
    res.json({
        date: date,
        discount: discount
    });
});

// Отправка заявки в Telegram
app.post('/send-request', (req, res) => {
    const { name, phone, service, email, message} = req.body;

    const telegramMessage = `
🧹 *NOVÁ POPTÁVKA - KALKULÁTOR ÚKLIDU*

👤 *Jméno:* ${name}
📞 *Telefon:* ${phone}
📧 *Email:* ${email}
🛠 *Služba:* ${service}

📋 *DETAILY OBJEDNÁVKY:*
${message}

⏰ *Čas přijetí:* ${new Date().toLocaleString('cs-CZ')}
    `;

    bot.sendMessage(chatId, telegramMessage , { parse_mode: 'Markdown' })
        .then(() => {
            console.log('✅ Zpráva odeslána do Telegramu');
            
            // Автоматически бронируем время после успешной отправки
            // Извлекаем дату и время из message
            const dateMatch = message.match(/Datum: (\d{4}-\d{2}-\d{2})/);
            const timeMatch = message.match(/Čas: (\d{2}:\d{2})/);
            
            if (dateMatch && timeMatch) {
                const date = dateMatch[1];
                const time = timeMatch[1];
                
                const timeSlots = readTimeSlots();
                if (!timeSlots.bookedTimeSlots[date]) {
                    timeSlots.bookedTimeSlots[date] = [];
                }
                
                if (!timeSlots.bookedTimeSlots[date].includes(time)) {
                    timeSlots.bookedTimeSlots[date].push(time);
                    saveTimeSlots(timeSlots);
                    console.log(`🔒 Автоматически забронировано: ${date} в ${time}`);
                }
            }
            
            res.status(200).send({ success: true });
        })
        .catch((err) => {
            console.error('❌ Chyba při odesílání do Telegramu:', err);
            res.status(500).send({ success: false, error: err.message });
        });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Server běží na: http://localhost:${PORT}`);
    console.log(`📱 Telegram bot připraven`);
    console.log(`💡 API endpoints dostupné:`);
    console.log(`   GET  /api/time-slots - získat všechny časové sloty`);
    console.log(`   GET  /api/time-slots/:date - získat sloty pro datum`);
    console.log(`   POST /api/book-time - zarezervovat čas`);
    console.log(`   POST /api/free-time - uvolnit čas`);
    console.log(`   POST /api/update-time-slots - aktualizovat dostupné časy`);
    console.log(`   POST /send-request - odeslat poptávku`);
    
    // Создаём файл timeSlots.json если его нет
    if (!fs.existsSync(TIME_SLOTS_FILE)) {
        const defaultData = {
            availableTimeSlots: {
                '2024-02-20': ['09:00', '11:00', '14:00', '16:00'],
                '2024-02-21': ['10:00', '13:00', '15:00']
            },
            defaultTimeSlots: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
            bookedTimeSlots: {},
            discounts: {} // Инициализируем пустой объект скидок
        };
        saveTimeSlots(defaultData);
        console.log('✅ Vytvořen výchozí soubor timeSlots.json');
    }
});
