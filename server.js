const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const os = require('os');
const networkConfig = require('./config/network');

// Ładujemy zmienne środowiskowe
require('dotenv').config();

// Ustawiamy strefę czasową dla Polski
process.env.TZ = 'Europe/Warsaw';

const app = express();
const { host: HOST, port: PORT } = networkConfig.server;

// Konfiguracja zaufania proxy dla pracy w sieci
if (networkConfig.security.trustProxy) {
  app.set('trust proxy', 1);
}

// Middleware z ustawieniami dla sieci
app.use(cors(networkConfig.cors));
app.use(express.json());
app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));

// Konfiguracja sesji z konfiguracją dla sieci
app.use(session(networkConfig.session));

// Multer do przesyłania plików
const upload = multer({ dest: 'uploads/' });

// Inicjalizacja bazy danych
const fs = require('fs');
const dbPath = process.env.DB_PATH || './data/ip_management.db';

// Tworzymy katalog dla bazy danych jeśli nie istnieje
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Błąd otwierania bazy danych:', err);
        process.exit(1);
    } else {
        console.log('Połączono z bazą danych SQLite:', dbPath);
    }
});

// Tworzenie tabel
db.serialize(() => {
  // Tabela użytkowników
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  // Tworzenie domyślnego administratora
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultPasswordHash = bcrypt.hashSync(adminPassword, 10);
  
  db.run(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role) 
          VALUES (?, ?, 'Administrator', 'admin')`, [adminUsername, defaultPasswordHash]);

  // Tabela podsieci
  db.run(`CREATE TABLE IF NOT EXISTS subnets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network TEXT NOT NULL,
    mask INTEGER NOT NULL,
    description TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migracja: dodajemy ograniczenie unikalności dla istniejącej tabeli
  db.get("PRAGMA table_info(subnets)", (err, info) => {
    if (!err) {
      // Sprawdzamy, czy istnieje już unikalny indeks
      db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='unique_subnet_network_mask'", (err, index) => {
        if (!err && !index) {
          // Tworzymy unikalny indeks, jeśli go nie ma
          db.run("CREATE UNIQUE INDEX unique_subnet_network_mask ON subnets(network, mask)", (err) => {
            if (err) {
              console.error('Błąd tworzenia unikalnego indeksu:', err.message);
            } else {
              console.log('Unikalny indeks dla podsieci utworzony pomyślnie');
            }
          });
        }
      });
    }
  });

  // Tabela adresów IP
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

  // Tabela logów audytu
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

// Funkcja do zapisu w logu audytu
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
        console.error('Błąd zapisu w logu audytu:', err.message);
      }
    });
}

// Middleware do sprawdzania autoryzacji
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: 'Wymagana autoryzacja' });
  }
}

// Trasa dla strony głównej
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

// Trasy API autoryzacji

// Logowanie do systemu
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      // Logujemy nieudaną próbę logowania
      logAudit(req, 'LOGIN_FAILED', 'user', null, null, { username });
      res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
      return;
    }
    
    // Aktualizujemy czas ostatniego logowania
    db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    
    // Tworzymy sesję
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    // Logujemy pomyślne logowanie
    logAudit(req, 'LOGIN_SUCCESS', 'user', user.id, null, { username: user.username });
    
    res.json({ 
      message: 'Pomyślna autoryzacja',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  });
});

// Wylogowanie z systemu
app.post('/api/logout', (req, res) => {
  // Logujemy wylogowanie z systemu
  logAudit(req, 'LOGOUT', 'user', req.session?.userId);
  
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Błąd przy wylogowaniu z systemu' });
      return;
    }
    res.json({ message: 'Pomyślne wylogowanie z systemu' });
  });
});

// Sprawdzanie statusu autoryzacji
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

// Trasy API (teraz chronione autoryzacją)

// Pobranie wszystkich podsieci
app.get('/api/subnets', requireAuth, (req, res) => {
  db.all("SELECT * FROM subnets ORDER BY created_date DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Utworzenie podsieci
app.post('/api/subnets', requireAuth, (req, res) => {
  const { network, mask, description } = req.body;
  
  db.run("INSERT INTO subnets (network, mask, description) VALUES (?, ?, ?)",
    [network, mask, description], function(err) {
      if (err) {
        logAudit(req, 'CREATE_SUBNET_FAILED', 'subnet', null, null, { network, mask, description, error: err.message });
        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
          res.status(400).json({ error: `Podsieć ${network}/${mask} już istnieje` });
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

// Edytowanie podsieci
app.put('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { network, mask, description } = req.body;
  
  // Najpierw pobieramy stare wartości
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
            res.status(400).json({ error: `Podsieć ${network}/${mask} już istnieje` });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Podsieć nie została znaleziona' });
          return;
        }
        
        const newSubnet = { id, network, mask, description };
        logAudit(req, 'UPDATE_SUBNET', 'subnet', id, oldSubnet, newSubnet);
        res.json({ message: 'Podsieć została zaktualizowana', id, network, mask, description });
      });
  });
});

// Pobranie wszystkich adresów IP
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

// Dodanie adresu IP
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

// Aktualizacja adresu IP
app.put('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { ip_address, subnet_id, company_name, assigned_date, is_occupied, description } = req.body;
  
  // Pobieramy stare wartości
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
        res.json({ message: 'Adres IP został zaktualizowany' });
      });
  });
});

// Masowe usuwanie adresów IP
app.delete('/api/ip-addresses/bulk', requireAuth, (req, res) => {
  console.log('=== MASOWE USUWANIE ADRESÓW IP ===');
  console.log('Otrzymano żądanie body:', req.body);
  const { start_ip, end_ip, subnet_id } = req.body;
  
  // Funkcja do przekształcenia IP na liczbę
  function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
  
  try {
    const startNum = ipToNumber(start_ip);
    const endNum = ipToNumber(end_ip);
    
    if (startNum > endNum) {
      res.status(400).json({ error: 'Początkowy IP musi być mniejszy od końcowego IP' });
      return;
    }
    
    const totalIps = endNum - startNum + 1;
    if (totalIps > 1000) {
      res.status(400).json({ error: 'Maksymalna liczba adresów IP do masowego usuwania: 1000' });
      return;
    }
    
    // Tworzymy tablicę adresów IP w zakresie
    const ipList = [];
    for (let i = startNum; i <= endNum; i++) {
      const ip = [(i >>> 24) & 255, (i >>> 16) & 255, (i >>> 8) & 255, i & 255].join('.');
      ipList.push(ip);
    }
    
    // Tworzymy zapytanie do wyszukiwania adresów IP w zakresie
    let query = `SELECT * FROM ip_addresses WHERE ip_address IN (${ipList.map(() => '?').join(',')})`;
    let params = [...ipList];
    
    if (subnet_id) {
      query += ` AND subnet_id = ?`;
      params.push(subnet_id);
    }
    
    // Najpierw pobieramy adresy IP do logowania
    db.all(query, params, (err, ipsToDelete) => {
      if (err) {
        logAudit(req, 'BULK_DELETE_IP_FAILED', 'ip_address', null, null, { 
          start_ip, 
          end_ip, 
          subnet_id,
          error: err.message 
        });
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (ipsToDelete.length === 0) {
        res.json({ 
          message: 'Brak adresów IP do usunięcia w podanym zakresie',
          deleted_count: 0,
          deleted_ips: []
        });
        return;
      }
      
      // Teraz usuwamy znalezione adresy IP
      const existingIps = ipsToDelete.map(ip => ip.ip_address);
      
      // Dodajemy informacje debugowania
      console.log(`Znaleziono IP do usunięcia: ${existingIps.length}`);
      console.log('Adresy IP:', existingIps);
      
      let deleteQuery = `DELETE FROM ip_addresses WHERE ip_address IN (${existingIps.map(() => '?').join(',')})`;
      let deleteParams = [...existingIps];
      
      if (subnet_id) {
        deleteQuery += ` AND subnet_id = ?`;
        deleteParams.push(subnet_id);
      }
      
      console.log('Delete query:', deleteQuery);
      console.log('Delete params:', deleteParams);
      
      db.run(deleteQuery, deleteParams, function(err) {
        if (err) {
          console.error('Błąd podczas usuwania:', err);
          logAudit(req, 'BULK_DELETE_IP_FAILED', 'ip_address', null, null, { 
            start_ip, 
            end_ip, 
            subnet_id,
            error: err.message 
          });
          res.status(500).json({ error: err.message });
          return;
        }
        
        const deletedCount = this.changes;
        console.log(`Faktycznie usunięto rekordów: ${deletedCount}`);
        
        const deletedIps = ipsToDelete.map(ip => ip.ip_address);
        
        // Logujemy masowe usuwanie
        const bulkDeleteData = { 
          start_ip, 
          end_ip, 
          subnet_id, 
          deleted_count: deletedCount,
          deleted_ips: deletedIps
        };
        logAudit(req, 'BULK_DELETE_IP', 'ip_address', null, ipsToDelete, bulkDeleteData);
        
        res.json({ 
          message: `Usunięto ${deletedCount} adresów IP z zakresu ${start_ip} - ${end_ip}`,
          deleted_count: deletedCount,
          deleted_ips: deletedIps
        });
      });
    });
    
  } catch (error) {
    logAudit(req, 'BULK_DELETE_IP_FAILED', 'ip_address', null, null, { 
      start_ip, 
      end_ip, 
      subnet_id,
      error: error.message 
    });
    res.status(500).json({ error: 'Błąd podczas masowego usuwania adresów IP: ' + error.message });
  }
});

// Usunięcie adresu IP
app.delete('/api/ip-addresses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Pobieramy dane przed usunięciem
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
      res.json({ message: 'Adres IP został usunięty' });
    });
  });
});

// Usunięcie podsieci
app.delete('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Pobieramy dane podsieci przed usunięciem
  db.get("SELECT * FROM subnets WHERE id = ?", [id], (err, subnet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Najpierw odłączamy adresy IP od tej podsieci
    db.run("UPDATE ip_addresses SET subnet_id = NULL WHERE subnet_id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Następnie usuwamy samą podsieć
      db.run("DELETE FROM subnets WHERE id = ?", [id], function(err) {
        if (err) {
          logAudit(req, 'DELETE_SUBNET_FAILED', 'subnet', id, subnet, { error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        
        logAudit(req, 'DELETE_SUBNET', 'subnet', id, subnet, null);
        res.json({ message: 'Podsieć została usunięta' });
      });
    });
  });
});

// Masowe dodawanie adresów IP
app.post('/api/ip-addresses/bulk', requireAuth, (req, res) => {
  const { subnet_id, start_ip, end_ip, company_name, assigned_date, is_occupied, description } = req.body;
  
  // Funkcja do przekształcenia IP na liczbę
  function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
  
  // Funkcja do przekształcenia liczby na IP
  function numberToIp(num) {
    return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
  }
  
  try {
    const startNum = ipToNumber(start_ip);
    const endNum = ipToNumber(end_ip);
    
    if (startNum > endNum) {
      res.status(400).json({ error: 'Początkowy IP musi być mniejszy od końcowego IP' });
      return;
    }
    
    const totalIps = endNum - startNum + 1;
    if (totalIps > 1000) {
      res.status(400).json({ error: 'Maksymalna liczba adresów IP do masowego tworzenia: 1000' });
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
    
    // Logujemy masowe tworzenie IP
    const bulkData = { start_ip, end_ip, subnet_id, company_name, assigned_date, is_occupied, description, created_count: createdCount };
    logAudit(req, 'BULK_CREATE_IP', 'ip_address', null, null, bulkData);
    
    res.json({ 
      message: `Utworzono ${createdCount} adresów IP z ${totalIps}`,
      created_count: createdCount,
      total_requested: totalIps,
      errors: errors
    });
    
  } catch (error) {
    logAudit(req, 'BULK_CREATE_IP_FAILED', 'ip_address', null, null, { start_ip, end_ip, error: error.message });
    res.status(500).json({ error: 'Błąd podczas masowego tworzenia adresów IP: ' + error.message });
  }
});

// Import z Excel
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
              errors.push(`Wiersz ${index + 1}: ${err.message}`);
            } else if (this.changes > 0) {
              imported++;
            }
          });
      }
    });

    setTimeout(() => {
      // Logujemy import
      logAudit(req, 'IMPORT_EXCEL', 'ip_address', null, null, { 
        filename: req.file.originalname, 
        imported_count: imported, 
        total_rows: data.length,
        errors_count: errors.length 
      });
      
      res.json({ 
        message: `Zaimportowano ${imported} rekordów`, 
        errors: errors 
      });
    }, 1000);

  } catch (error) {
    logAudit(req, 'IMPORT_EXCEL_FAILED', 'ip_address', null, null, { error: error.message });
    res.status(500).json({ error: 'Błąd podczas przetwarzania pliku Excel' });
  }
});

// Pobranie logów audytu
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
  
  // Pobieramy całkowitą liczbę rekordów
  db.get(countQuery, params.slice(0, -2), (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Pobieramy rekordy dla bieżącej strony
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

// Pobranie szczegółów konkretnego loga
app.get('/api/audit-logs/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM audit_logs WHERE id = ?", [id], (err, log) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!log) {
      res.status(404).json({ error: 'Log nie został znaleziony' });
      return;
    }
    
    res.json(log);
  });
});

// Statystyki
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

// Аналитика - общая статистика с фильтрами
app.get('/api/analytics/stats', requireAuth, (req, res) => {
  const { subnet_id, date_from, date_to } = req.query;
  
  let query = `SELECT 
    COUNT(*) as total_ips,
    SUM(CASE WHEN is_occupied = 1 THEN 1 ELSE 0 END) as occupied_ips,
    SUM(CASE WHEN is_occupied = 0 THEN 1 ELSE 0 END) as free_ips,
    (SELECT COUNT(*) FROM subnets) as total_subnets
    FROM ip_addresses WHERE 1=1`;
  
  let params = [];
  
  if (subnet_id) {
    query += " AND subnet_id = ?";
    params.push(subnet_id);
  }
  
  if (date_from) {
    query += " AND created_date >= ?";
    params.push(date_from);
  }
  
  if (date_to) {
    query += " AND created_date <= ?";
    params.push(date_to + ' 23:59:59');
  }
  
  db.get(query, params, (err, stats) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json(stats || { total_ips: 0, occupied_ips: 0, free_ips: 0, total_subnets: 0 });
  });
});

// Аналитика - IP адреса по подсетям
app.get('/api/analytics/subnets', requireAuth, (req, res) => {
  const { date_from, date_to } = req.query;
  
  let query = `SELECT 
    s.network,
    s.mask,
    COUNT(ip.id) as ip_count,
    SUM(CASE WHEN ip.is_occupied = 1 THEN 1 ELSE 0 END) as occupied_count,
    SUM(CASE WHEN ip.is_occupied = 0 THEN 1 ELSE 0 END) as free_count
    FROM subnets s
    LEFT JOIN ip_addresses ip ON s.id = ip.subnet_id`;
  
  let params = [];
  
  if (date_from || date_to) {
    query += " AND (ip.id IS NULL";
    if (date_from) {
      query += " OR ip.created_date >= ?";
      params.push(date_from);
    }
    if (date_to) {
      query += " OR ip.created_date <= ?";
      params.push(date_to + ' 23:59:59');
    }
    query += ")";
  }
  
  query += " GROUP BY s.id, s.network, s.mask ORDER BY ip_count DESC LIMIT 10";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Аналитика - компании по использованию IP
app.get('/api/analytics/companies', requireAuth, (req, res) => {
  const { subnet_id, date_from, date_to } = req.query;
  
  let query = `SELECT 
    COALESCE(company_name, 'Без компании') as company,
    COUNT(*) as ip_count
    FROM ip_addresses 
    WHERE 1=1`;
  
  let params = [];
  
  if (subnet_id) {
    query += " AND subnet_id = ?";
    params.push(subnet_id);
  }
  
  if (date_from) {
    query += " AND created_date >= ?";
    params.push(date_from);
  }
  
  if (date_to) {
    query += " AND created_date <= ?";
    params.push(date_to + ' 23:59:59');
  }
  
  query += " GROUP BY company_name ORDER BY ip_count DESC LIMIT 10";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Аналитика - активность по месяцам
app.get('/api/analytics/monthly', requireAuth, (req, res) => {
  const { subnet_id } = req.query;
  
  let query = `SELECT 
    strftime('%Y-%m', created_date) as month,
    COUNT(*) as count
    FROM ip_addresses 
    WHERE created_date >= date('now', '-12 months')`;
  
  let params = [];
  
  if (subnet_id) {
    query += " AND subnet_id = ?";
    params.push(subnet_id);
  }
  
  query += " GROUP BY strftime('%Y-%m', created_date) ORDER BY month";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Аналитика - утилизация подсетей
app.get('/api/analytics/utilization', requireAuth, (req, res) => {
  const query = `SELECT 
    s.network,
    s.mask,
    COUNT(ip.id) as used_ips,
    (1 << (32 - s.mask)) - 2 as total_ips,
    ROUND((COUNT(ip.id) * 100.0) / ((1 << (32 - s.mask)) - 2), 2) as utilization
    FROM subnets s
    LEFT JOIN ip_addresses ip ON s.id = ip.subnet_id
    GROUP BY s.id, s.network, s.mask
    ORDER BY utilization DESC`;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Функция для получения сетевых адресов
function getNetworkAddresses() {
  const addresses = [];
  const networkInterfaces = os.networkInterfaces();
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        addresses.push({
          interface: interfaceName,
          address: interface.address,
          url: `http://${interface.address}:${PORT}`
        });
      }
    });
  });
  
  return addresses;
}

app.listen(PORT, HOST, () => {
  console.log('\n🚀 IP Management System запущен!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Хост: ${HOST}`);
  console.log(`🔌 Порт: ${PORT}`);
  console.log(`🌍 Окружение: ${networkConfig.server.environment}`);
  console.log('');
  
  // Локальные адреса
  console.log('🏠 Локальный доступ:');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log('');
  
  // Сетевые адреса
  const networkAddresses = getNetworkAddresses();
  if (networkAddresses.length > 0) {
    console.log('🌐 Доступ из локальной сети:');
    networkAddresses.forEach(addr => {
      console.log(`   ${addr.url} (${addr.interface})`);
    });
    console.log('');
    console.log('💡 Подключайтесь с любого устройства в сети используя эти адреса!');
  } else {
    console.log('⚠️  Сетевые интерфейсы не найдены');
  }
  
  console.log('');
  console.log('🔐 Данные для входа:');
  console.log(`   👤 Логин: ${process.env.ADMIN_USERNAME || 'admin'}`);
  console.log(`   🔑 Пароль: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log('');
  console.log('📋 Полезные команды:');
  console.log('   npm run info     - показать сетевую информацию');
  console.log('   npm run network  - запуск для сети');
  console.log('   npm run dev      - режим разработки');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Готов к работе!\n');
});

