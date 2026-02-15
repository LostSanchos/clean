// 🔧 СКРИПТ ДЛЯ ЗАМЕНЫ URL
// Этот файл поможет быстро обновить все ссылки после деплоя

// ❗ ИНСТРУКЦИЯ:
// 1. После того как получишь ссылку от Render (например: https://booking-system-xxxx.onrender.com)
// 2. Замени 'YOUR_RENDER_URL' ниже на свою реальную ссылку
// 3. Запусти: node update-urls.js

const fs = require('fs');
const path = require('path');

// 👇 ЗАМЕНИ ЭТУ ССЫЛКУ НА СВОЮ!
const YOUR_RENDER_URL = 'https://твоя-ссылка.onrender.com'; // ⬅️ ЗАМЕНИ ЗДЕСЬ!

const filesToUpdate = [
    'admin-panel.html',
    'web.html',
    'index.html'
];

console.log('🔄 Начинаю замену URL...\n');

filesToUpdate.forEach(filename => {
    const filepath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filepath)) {
        console.log(`⚠️  Файл ${filename} не найден - пропускаю`);
        return;
    }
    
    try {
        let content = fs.readFileSync(filepath, 'utf8');
        
        // Заменяем все варианты localhost
        const replaced = content
            .replace(/http:\/\/localhost:3000/g, YOUR_RENDER_URL)
            .replace(/localhost:3000/g, YOUR_RENDER_URL.replace('https://', ''))
            .replace(/const API_URL = 'http:\/\/localhost:3000'/g, `const API_URL = '${YOUR_RENDER_URL}'`);
        
        fs.writeFileSync(filepath, replaced, 'utf8');
        console.log(`✅ Обновлён: ${filename}`);
    } catch (error) {
        console.log(`❌ Ошибка в файле ${filename}:`, error.message);
    }
});

console.log('\n✨ Готово! Все файлы обновлены.');
console.log('📤 Теперь загрузи их обратно на GitHub');
