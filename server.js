const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Устанавливаем временную зону для Польши
process.env.TZ = 'Europe/Warsaw';

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

  // Миграция: добавляем уникальное ограничение для существующей таблицы
  db.get("PRAGMA table_info(subnets)", (err, info) => {
    if (!err) {
      // Проверяем, есть ли уже уникальный индекс
      db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='unique_subnet_network_mask'", (err, index) => {
        if (!err && !index) {
          // Создаем уникальный индекс, если его нет
          db.run("CREATE UNIQUE INDEX unique_subnet_network_mask ON subnets(network, mask)", (err) => {
            if (err) {
              console.error('Ошибка создания уникального индекса:', err.message);
            } else {
              console.log('Уникальный индекс для подсетей создан успешно');
            }
          });
        }
      });
    }
  });

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

  // Таблица логов аудита
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// Функция для записи в лог аудита
function logAudit(req, action, entityType, entityId = null, oldValues = null, newValues = null) {
  const logData = {
    user_id: req.session?.userId || null,
    username: req.session?.username || 'system',
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues ? JSON.stringify(oldValues) : null,
    new_values: newValues ? JSON.stringify(newValues) : null,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent') || null
  };

  db.run(`INSERT INTO audit_logs 
          (user_id, username, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logData.user_id, logData.username, logData.action, logData.entity_type, 
     logData.entity_id, logData.old_values, logData.new_values, logData.ip_address, logData.user_agent],
    function(err) {
      if (err) {
        console.error('Ошибка записи в лог аудита:', err.message);
      }
    });
}

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
      // Логируем неудачную попытку входа
      logAudit(req, 'LOGIN_FAILED', 'user', null, null, { username });
      res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }
    
    // Обновляем время последнего входа
    db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    
    // Создаем сессию
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    // Логируем успешный вход
    logAudit(req, 'LOGIN_SUCCESS', 'user', user.id, null, { username: user.username });
    
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
  // Логируем выход из системы
  logAudit(req, 'LOGOUT', 'user', req.session?.userId);
  
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
        logAudit(req, 'CREATE_SUBNET_FAILED', 'subnet', null, null, { network, mask, description, error: err.message });
        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
          res.status(400).json({ error: `Подсеть ${network}/${mask} уже существует` });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      
      const subnetData = { id: this.lastID, network, mask, description };
      logAudit(req, 'CREATE_SUBNET', 'subnet', this.lastID, null, subnetData);
      res.json(subnetData);
    });
});

// Редактировать подсеть
app.put('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { network, mask, description } = req.body;
  
  // Сначала получаем старые значения
  db.get("SELECT * FROM subnets WHERE id = ?", [id], (err, oldSubnet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run("UPDATE subnets SET network = ?, mask = ?, description = ? WHERE id = ?",
      [network, mask, description, id], function(err) {
        if (err) {
          logAudit(req, 'UPDATE_SUBNET_FAILED', 'subnet', id, oldSubnet, { network, mask, description, error: err.message });
          if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
            res.status(400).json({ error: `Подсеть ${network}/${mask} уже существует` });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Подсеть не найдена' });
          return;
        }
        
        const newSubnet = { id, network, mask, description };
        logAudit(req, 'UPDATE_SUBNET', 'subnet', id, oldSubnet, newSubnet);
        res.json({ message: 'Подсеть обновлена', id, network, mask, description });
      });
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
        logAudit(req, 'CREATE_IP_FAILED', 'ip_address', null, null, { ip_address, error: err.message });
        res.status(500).json({ error: err.message });
        return;
      }
      
      const ipData = { id: this.lastID, ip_address, subnet_id, company_name, assigned_date, is_occupied, description };
      logAudit(req, 'CREATE_IP', 'ip_address', this.lastID, null, ipData);
      res.json(ipData);
    });
});

// Обновить IP адрес
app.put('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { ip_address, subnet_id, company_name, assigned_date, is_occupied, description } = req.body;
  
  // Получаем старые значения
  db.get("SELECT * FROM ip_addresses WHERE id = ?", [id], (err, oldIp) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(`UPDATE ip_addresses 
            SET ip_address = ?, subnet_id = ?, company_name = ?, assigned_date = ?, is_occupied = ?, description = ?
            WHERE id = ?`,
      [ip_address, subnet_id, company_name, assigned_date, is_occupied, description, id],
      function(err) {
        if (err) {
          logAudit(req, 'UPDATE_IP_FAILED', 'ip_address', id, oldIp, { ip_address, error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        
        const newIp = { id, ip_address, subnet_id, company_name, assigned_date, is_occupied, description };
        logAudit(req, 'UPDATE_IP', 'ip_address', id, oldIp, newIp);
        res.json({ message: 'IP адрес обновлен' });
      });
  });
});

// Удалить IP адрес
app.delete('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Получаем данные перед удалением
  db.get("SELECT * FROM ip_addresses WHERE id = ?", [id], (err, ip) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run("DELETE FROM ip_addresses WHERE id = ?", [id], function(err) {
      if (err) {
        logAudit(req, 'DELETE_IP_FAILED', 'ip_address', id, ip, { error: err.message });
        res.status(500).json({ error: err.message });
        return;
      }
      
      logAudit(req, 'DELETE_IP', 'ip_address', id, ip, null);
      res.json({ message: 'IP адрес удален' });
    });
  });
});

// Удалить подсеть
app.delete('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Получаем данные подсети перед удалением
  db.get("SELECT * FROM subnets WHERE id = ?", [id], (err, subnet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Сначала отвязываем IP адреса от этой подсети
    db.run("UPDATE ip_addresses SET subnet_id = NULL WHERE subnet_id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Затем удаляем саму подсеть
      db.run("DELETE FROM subnets WHERE id = ?", [id], function(err) {
        if (err) {
          logAudit(req, 'DELETE_SUBNET_FAILED', 'subnet', id, subnet, { error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        
        logAudit(req, 'DELETE_SUBNET', 'subnet', id, subnet, null);
        res.json({ message: 'Подсеть удалена' });
      });
    });
  });
});

// Массовое добавление IP адресов
app.post('/api/ip-addresses/bulk', requireAuth, (req, res) => {
  const { subnet_id, start_ip, end_ip, company_name, assigned_date, is_occupied, description } = req.body;
  
  // Функция для преобразования IP в число
  function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
  
  // Функция для преобразования числа в IP
  function numberToIp(num) {
    return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
  }
  
  try {
    const startNum = ipToNumber(start_ip);
    const endNum = ipToNumber(end_ip);
    
    if (startNum > endNum) {
      res.status(400).json({ error: 'Начальный IP должен быть меньше конечного IP' });
      return;
    }
    
    const totalIps = endNum - startNum + 1;
    if (totalIps > 1000) {
      res.status(400).json({ error: 'Максимальное количество IP адресов для массового создания: 1000' });
      return;
    }
    
    let createdCount = 0;
    let errors = [];
    
    const stmt = db.prepare(`INSERT OR IGNORE INTO ip_addresses 
                            (ip_address, subnet_id, company_name, assigned_date, is_occupied, description) 
                            VALUES (?, ?, ?, ?, ?, ?)`);
    
    for (let i = startNum; i <= endNum; i++) {
      const ip = numberToIp(i);
      
      try {
        const result = stmt.run(ip, subnet_id, company_name, assigned_date, is_occupied, description);
        if (result.changes > 0) {
          createdCount++;
        }
      } catch (err) {
        errors.push(`IP ${ip}: ${err.message}`);
      }
    }
    
    stmt.finalize();
    
    // Логируем массовое создание IP
    const bulkData = { start_ip, end_ip, subnet_id, company_name, assigned_date, is_occupied, description, created_count: createdCount };
    logAudit(req, 'BULK_CREATE_IP', 'ip_address', null, null, bulkData);
    
    res.json({ 
      message: `Создано ${createdCount} IP адресов из ${totalIps}`,
      created_count: createdCount,
      total_requested: totalIps,
      errors: errors
    });
    
  } catch (error) {
    logAudit(req, 'BULK_CREATE_IP_FAILED', 'ip_address', null, null, { start_ip, end_ip, error: error.message });
    res.status(500).json({ error: 'Ошибка при массовом создании IP адресов: ' + error.message });
  }
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
      // Логируем импорт
      logAudit(req, 'IMPORT_EXCEL', 'ip_address', null, null, { 
        filename: req.file.originalname, 
        imported_count: imported, 
        total_rows: data.length,
        errors_count: errors.length 
      });
      
      res.json({ 
        message: `Импортировано ${imported} записей`, 
        errors: errors 
      });
    }, 1000);

  } catch (error) {
    logAudit(req, 'IMPORT_EXCEL_FAILED', 'ip_address', null, null, { error: error.message });
    res.status(500).json({ error: 'Ошибка при обработке файла Excel' });
  }
});

// Получить логи аудита
app.get('/api/audit-logs', requireAuth, (req, res) => {
  const { page = 1, limit = 50, action, entity_type, username } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
  let params = [];
  
  if (action) {
    query += ` AND action LIKE ?`;
    countQuery += ` AND action LIKE ?`;
    params.push(`%${action}%`);
  }
  
  if (entity_type) {
    query += ` AND entity_type = ?`;
    countQuery += ` AND entity_type = ?`;
    params.push(entity_type);
  }
  
  if (username) {
    query += ` AND username LIKE ?`;
    countQuery += ` AND username LIKE ?`;
    params.push(`%${username}%`);
  }
  
  query += ` ORDER BY created_date DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  
  // Получаем общее количество записей
  db.get(countQuery, params.slice(0, -2), (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Получаем записи для текущей страницы
    db.all(query, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        logs: rows,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.total / limit)
      });
    });
  });
});

// Получить детали конкретного лога
app.get('/api/audit-logs/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM audit_logs WHERE id = ?", [id], (err, log) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!log) {
      res.status(404).json({ error: 'Лог не найден' });
      return;
    }
    
    res.json(log);
  });
});

// Статистика
app.get('/api/stats', requireAuth, (req, res) => {
  db.all(`SELECT 
    COUNT(*) as total_ips,
    SUM(CASE WHEN is_occupied = 1 THEN 1 ELSE 0 END) as occupied_ips,
    SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as free_ips,
    (SELECT COUNT(*) FROM subnets) as total_subnets
    FROM ip_addresses`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = rows[0] || {
      total_ips: 0,
      occupied_ips: 0,
      free_ips: 0,
      total_subnets: 0
    };
    
    res.json(stats);
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});