const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));

// Настройка сессий
app.use(session({
  secret: 'ip-management-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true для HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Multer для загрузки файлов
const upload = multer({ dest: 'uploads/' });

// Инициализация базы данных
const db = new sqlite3.Database('ip_management.db');

// Создание таблиц
db.serialize(() => {
  // Таблица пользователей
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  // Создание администратора по умолчанию
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role) 
          VALUES ('admin', ?, 'Администратор', 'admin')`, [defaultPassword]);

  // Таблица подсетей
  db.run(`CREATE TABLE IF NOT EXISTS subnets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network TEXT NOT NULL,
    mask INTEGER NOT NULL,
    description TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица IP адресов
  db.run(`CREATE TABLE IF NOT EXISTS ip_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    subnet_id INTEGER,
    company_name TEXT,
    assigned_date DATE,
    is_occupied INTEGER DEFAULT 0,
    description TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subnet_id) REFERENCES subnets (id)
  )`);
});

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: 'Необходима авторизация' });
  }
}

// Маршрут для главной страницы
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

// API маршруты авторизации

// Вход в систему
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }
    
    // Обновляем время последнего входа
    db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    
    // Создаем сессию
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    res.json({ 
      message: 'Успешная авторизация',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  });
});

// Выход из системы
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при выходе из системы' });
      return;
    }
    res.json({ message: 'Успешный выход из системы' });
  });
});

// Проверка статуса авторизации
app.get('/api/auth-status', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// API маршруты (теперь защищены авторизацией)

// Получить все подсети
app.get('/api/subnets', requireAuth, (req, res) => {
  db.all("SELECT * FROM subnets ORDER BY created_date DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Создать подсеть
app.post('/api/subnets', requireAuth, (req, res) => {
  const { network, mask, description } = req.body;
  
  db.run("INSERT INTO subnets (network, mask, description) VALUES (?, ?, ?)",
    [network, mask, description], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, network, mask, description });
    });
});

// Получить все IP адреса
app.get('/api/ip-addresses', requireAuth, (req, res) => {
  const { subnet_id, occupied, search } = req.query;
  
  let query = `SELECT ip.*, s.network, s.mask 
               FROM ip_addresses ip 
               LEFT JOIN subnets s ON ip.subnet_id = s.id 
               WHERE 1=1`;
  let params = [];

  if (subnet_id) {
    query += " AND ip.subnet_id = ?";
    params.push(subnet_id);
  }

  if (occupied !== undefined) {
    query += " AND ip.is_occupied = ?";
    params.push(occupied);
  }

  if (search) {
    query += " AND (ip.ip_address LIKE ? OR ip.company_name LIKE ? OR ip.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += " ORDER BY ip.ip_address";

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Добавить IP адрес
app.post('/api/ip-addresses', requireAuth, (req, res) => {
  const { ip_address, subnet_id, company_name, assigned_date, is_occupied, description } = req.body;
  
  db.run(`INSERT INTO ip_addresses (ip_address, subnet_id, company_name, assigned_date, is_occupied, description) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [ip_address, subnet_id, company_name, assigned_date, is_occupied, description], 
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID, 
        ip_address, 
        subnet_id, 
        company_name, 
        assigned_date, 
        is_occupied, 
        description 
      });
    });
});

// Обновить IP адрес
app.put('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { ip_address, subnet_id, company_name, assigned_date, is_occupied, description } = req.body;
  
  db.run(`UPDATE ip_addresses 
          SET ip_address = ?, subnet_id = ?, company_name = ?, assigned_date = ?, is_occupied = ?, description = ?
          WHERE id = ?`,
    [ip_address, subnet_id, company_name, assigned_date, is_occupied, description, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'IP адрес обновлен' });
    });
});

// Удалить IP адрес
app.delete('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM ip_addresses WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'IP адрес удален' });
  });
});

// Импорт из Excel
app.post('/api/import-excel', requireAuth, upload.single('excelFile'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    let errors = [];

    data.forEach((row, index) => {
      const { ip_address, company_name, assigned_date, is_occupied, description } = row;
      
      if (ip_address) {
        db.run(`INSERT OR IGNORE INTO ip_addresses 
                (ip_address, company_name, assigned_date, is_occupied, description) 
                VALUES (?, ?, ?, ?, ?)`,
          [ip_address, company_name || '', assigned_date || null, is_occupied || 0, description || ''],
          function(err) {
            if (err) {
              errors.push(`Строка ${index + 1}: ${err.message}`);
            } else if (this.changes > 0) {
              imported++;
            }
          });
      }
    });

    setTimeout(() => {
      res.json({ 
        message: `Импортировано ${imported} записей`, 
        errors: errors 
      });
    }, 1000);

  } catch (error) {
    res.status(500).json({ error: 'Ошибка при обработке файла Excel' });
  }
});

// Статистика
app.get('/api/stats', requireAuth, (req, res) => {
  db.all(`SELECT 
    COUNT(*) as total_ips,
    SUM(is_occupied) as occupied_ips,
    COUNT(*) - SUM(is_occupied) as free_ips,
    (SELECT COUNT(*) FROM subnets) as total_subnets
    FROM ip_addresses`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows[0]);
  });
});

// Удалить подсеть
app.delete('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Сначала отвязываем IP адреса от этой подсети
  db.run("UPDATE ip_addresses SET subnet_id = NULL WHERE subnet_id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Затем удаляем саму подсеть
    db.run("DELETE FROM subnets WHERE id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Подсеть удалена' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});