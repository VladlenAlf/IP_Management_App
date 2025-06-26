module.exports = {
  // Настройки сервера
  server: {
    host: process.env.HOST || '0.0.0.0', // 0.0.0.0 для доступа из сети
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Настройки CORS для локальной сети
  cors: {
    origin: function(origin, callback) {
      // Разрешаем запросы с любых IP в локальной сети
      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
      ];
      
      // Разрешаем запросы без origin (например, мобильные приложения)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      callback(null, isAllowed);
    },
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Настройки сессий для работы в сети
  session: {
    secret: process.env.SESSION_SECRET || 'ip-management-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 часа
      sameSite: 'lax' // Для работы в локальной сети
    }
  },
  
  // Настройки безопасности для локальной сети
  security: {
    trustProxy: process.env.NODE_ENV === 'production',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: process.env.NODE_ENV === 'production' ? 100 : 1000 // ограничений
    }
  }
};
