export type Language = 'uz' | 'ru';

export const translations = {
  uz: {
    // Auth & Register
    'register.title': "Ro'yxatdan o'tish",
    'register.note': "Parolingiz hisobingiz kalitidir. Uni unutmaslikka harakat qiling!",
    'register.name': "Ism",
    'register.name_placeholder': "Ismingizni kiriting",
    'register.username': "Foydalanuvchi nomi",
    'register.username_placeholder': "Masalan: barber_ali",
    'register.brandName': "Brend nomi (Ixtiyoriy)",
    'register.brandName_placeholder': "Masalan: Barber_Ali",
    'register.password': "Parol",
    'register.password_placeholder': "Kamida 6 ta belgi",
    'register.confirm_password': "Parolni qayta kiriting",
    'register.confirm_password_placeholder': "Parolni tasdiqlang",
    'register.mode': "Ishlash rejimi",
    'register.mode.solo': "👤 Yakka barber",
    'register.mode.solo_sub': "Faqat o'zim uchun",
    'register.mode.team': "👥 Jamoa",
    'register.mode.team_sub': "2 va undan ko'p sheriklarim bilan",
    'register.submit': "Ro'yxatdan o'tish",
    'register.have_account': "Allaqachon hisobingiz bormi?",
    'register.login_link': "Kirish",
    'register.error.pwd_short': "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
    'register.error.pwd_mismatch': "Parollar mos kelmayapti",
    'register.error.fill_required': "Majburiy maydonlarni to'ldiring",
    'register.error.register_failed': "Ro'yxatdan o'tishda xatolik yuz berdi. Qayta urinib ko'ring.",
    'login.error.invalid_credentials': "Ism yoki parol noto'g'ri. Qayta urinib ko'ring.",
    
    // Login
    'login.title': "Tizimga kirish",
    'login.submit': "Kirish",
    'login.no_account': "Akkauntingiz yo'qmi?",
    'login.telegram': "Telegram orqali kirish",
    'login.telegram.waiting.title': "Telegram kutilmoqda",
    'login.telegram.waiting.desc': "Bot \'✅ Ha, kirish\' tugmasini bosing — sahifa avtomatik ochiladi.",
    'login.telegram.cancel': "Bekor qilish",
    
    // Telegram Verify
    'verify.wait': "Barber.uz akkauntingiz deyarli tayyor! 🚀",
    'verify.message': "Mijozlaringiz bilan bog'lanish va bronlar haqida tezkor xabarnomalar olish uchun telegram botni faollashtiring. Bu atigi 10 soniya vaqt oladi:",
    'verify.btn': "Telegram orqali faollashtirish",
    'verify.checking': "Tasdiqlanish kutilmoqda...",
    'verify.step1': "Quyidagi tugmani bosib botni oching.",
    'verify.step2': "'Boshlash' tugmasini bosing va bot ishga tushadi.",
    'verify.step3': "'📱 Raqamni yuborish' tugmasini bosib telefon raqamni yuboring.",
    'verify.step4': "Bot profilni tasdiqlaydi va tayyor sahifangiz linkini beradi.",

    // Navigation
    'nav.dashboard': "Asosiy",
    'nav.calendar': "Kalendar",
    'nav.clients': "Mijozlar",
    'nav.settings': "Sozlamalar",

    // Dashboard
    'dash.scans': "Skanerlar",
    'dash.clicks': "Kliklar",
    'dash.today_bookings': "Bugungi Bronlar",
    'dash.today_revenue': "Bugungi Daromad",
    'dash.recent_bookings': "Yaqin bronlar",
    'dash.no_bookings': "Bugun uchun bronlar yo'q",

    // Calendar
    'cal.title': "Kalendar",
    'cal.add': "Yangi bron",
    
    // Clients
    'clients.title': "Mijozlar bazasi",
    'clients.search': "Ism yoki telefon...",
    'clients.filter.all': "Hammasi",
    'clients.filter.regular': "Doimiy 🔥",
    'clients.filter.new': "Yangi ✨",
    'clients.filter.blacklist': "Qora ro'yxat 🧊",
    'clients.add_quick': "Tezkor mijoz qo'shish",
    'clients.visits': "tashrif",
    
    // Settings
    'settings.title': "Sozlamalar",
    'settings.profile': "👤 Mening profilim",
    'settings.page': "🌐 Mening sahifam",
    'settings.notifications': "🔔 Bildirishnomalar",
    'settings.analytics': "📊 Tahlil va Statistika",
    'settings.security': "🛡 Xavfsizlik",
    'settings.logout': "🚪 Chiqish",

    // Profile Settings
    'profile.title': "Profil",
    'profile.hours': "Ish vaqti",
    'profile.save': "Saqlash",

    // Analytics
    'analytics.title': "Tahlil va Statistika",
    'analytics.period.week': "Hafta",
    'analytics.period.month': "Oy",
    'analytics.period.year': "Yil",
    'analytics.revenue': "Daromad",
    'analytics.bookings': "Bronlar soni",
    'analytics.top_services': "Eng ommabop xizmatlar",

    // Security
    'security.title': "Xavfsizlik",
    'security.pwd_update': "Parolni yangilash",
    'security.old_pwd': "Eski parol",
    'security.new_pwd': "Yangi parol",

    // Statuses
    'status.pending': "Kutilmoqda",
    'status.confirmed': "Tasdiqlangan",
    'status.completed': "Yakunlangan",
    'status.cancelled': "Bekor qilingan",

    // Generic
    'loading': "Yuklanmoqda...",
    'error': "Xatolik yuz berdi",
    'success': "Muvaffaqiyatli bajarildi",
  },
  ru: {
    // Auth & Register
    'register.title': "Регистрация",
    'register.note': "Ваш пароль — ключ к аккаунту. Постарайтесь не забыть его!",
    'register.name': "Имя",
    'register.name_placeholder': "Введите ваше имя",
    'register.username': "Имя пользователя",
    'register.username_placeholder': "Например: barber_ali",
    'register.brandName': "Название бренда (Необязательно)",
    'register.brandName_placeholder': "Например: Barber_Ali",
    'register.password': "Пароль",
    'register.password_placeholder': "Минимум 6 символов",
    'register.confirm_password': "Повторите пароль",
    'register.confirm_password_placeholder': "Подтвердите пароль",
    'register.mode': "Режим работы",
    'register.mode.solo': "👤 Соло барбер",
    'register.mode.solo_sub': "Только для меня",
    'register.mode.team': "👥 Команда",
    'register.mode.team_sub': "С 2 и более партнерами",
    'register.submit': "Зарегистрироваться",
    'register.have_account': "Уже есть аккаунт?",
    'register.login_link': "Войти",
    'register.error.pwd_short': "Пароль должен содержать не менее 6 символов",
    'register.error.pwd_mismatch': "Пароли не совпадают",
    'register.error.fill_required': "Заполните обязательные поля",
    'register.error.register_failed': "Ошибка регистрации. Попробуйте ещё раз.",
    'login.error.invalid_credentials': "Неверное имя или пароль. Попробуйте ещё раз.",

    // Login
    'login.title': "Вход в систему",
    'login.submit': "Войти",
    'login.no_account': "Нет аккаунта?",
    'login.telegram': "Войти через Telegram",
    'login.telegram.waiting.title': "Ожидание Telegram",
    'login.telegram.waiting.desc': "Нажмите '✅ Да, войти' в боте — страница откроется автоматически.",
    'login.telegram.cancel': "Отмена",

    // Telegram Verify
    'verify.wait': "Ваш аккаунт Barber.uz почти готов! 🚀",
    'verify.message': "Активируйте Telegram-бота для связи с клиентами и мгновенных уведомлений о бронированиях. Это займёт всего 10 секунд:",
    'verify.btn': "Активировать через Telegram",
    'verify.checking': "Ожидание подтверждения...",
    'verify.step1': "Нажмите кнопку ниже, чтобы открыть бота.",
    'verify.step2': "Нажмите кнопку 'Начать', чтобы запустить бота.",
    'verify.step3': "Нажмите '📱 Отправить номер' и поделитесь своим номером телефона.",
    'verify.step4': "Бот подтвердит профиль и отправит ссылку на вашу готовую страницу.",

    // Navigation
    'nav.dashboard': "Главная",
    'nav.calendar': "Календарь",
    'nav.clients': "Клиенты",
    'nav.settings': "Настройки",

    // Dashboard
    'dash.scans': "Скан-ры",
    'dash.clicks': "Клик-и",
    'dash.today_bookings': "Брони сегодня",
    'dash.today_revenue': "Доход сегодня",
    'dash.recent_bookings': "Ближайшие брони",
    'dash.no_bookings': "На сегодня броней нет",

    // Calendar
    'cal.title': "Календарь",
    'cal.add': "Новая бронь",

    // Clients
    'clients.title': "База клиентов",
    'clients.search': "Имя или телефон...",
    'clients.filter.all': "Все",
    'clients.filter.regular': "Постоянные 🔥",
    'clients.filter.new': "Новые ✨",
    'clients.filter.blacklist': "Чёрный список 🧊",
    'clients.add_quick': "Быстро добавить",
    'clients.visits': "визитов",

    // Settings
    'settings.title': "Настройки",
    'settings.profile': "👤 Мой профиль",
    'settings.page': "🌐 Моя страница",
    'settings.notifications': "🔔 Уведомления",
    'settings.analytics': "📊 Аналитика",
    'settings.security': "🛡 Безопасность",
    'settings.logout': "🚪 Выйти",

    // Profile Settings
    'profile.title': "Профиль",
    'profile.hours': "Рабочие часы",
    'profile.save': "Сохранить",

    // Analytics
    'analytics.title': "Аналитика",
    'analytics.period.week': "Неделя",
    'analytics.period.month': "Месяц",
    'analytics.period.year': "Год",
    'analytics.revenue': "Доход",
    'analytics.bookings': "Кол-во броней",
    'analytics.top_services': "Топ услуги",

    // Security
    'security.title': "Безопасность",
    'security.pwd_update': "Обновление пароля",
    'security.old_pwd': "Старый пароль",
    'security.new_pwd': "Новый пароль",

    // Statuses
    'status.pending': "Ожидает",
    'status.confirmed': "Подтвержден",
    'status.completed': "Завершен",
    'status.cancelled': "Отменен",

    // Generic
    'loading': "Загрузка...",
    'error': "Произошла ошибка",
    'success': "Успешно выполнено",
  }
};
