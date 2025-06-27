module.exports = {
  // Ustawienia serwera
  server: {
    host: process.env.HOST || '0.0.0.0', // 0.0.0.0 dla dostępu z sieci
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Ustawienia CORS dla sieci lokalnej
  cors: {
    origin: function(origin, callback) {
      // Zezwalamy na żądania z dowolnych IP w sieci lokalnej
      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
      ];
      
      // Zezwalamy na żądania bez origin (np. aplikacje mobilne)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      callback(null, isAllowed);
    },
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Ustawienia sesji dla pracy w sieci
  session: {
    secret: process.env.SESSION_SECRET || 'ip-management-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 godziny
      sameSite: 'lax' // Do pracy w sieci lokalnej
    }
  },
  
  // Ustawienia bezpieczeństwa dla sieci lokalnej
  security: {
    trustProxy: process.env.NODE_ENV === 'production',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minut
      max: process.env.NODE_ENV === 'production' ? 100 : 1000 // ograniczenia
    }
  }
};
