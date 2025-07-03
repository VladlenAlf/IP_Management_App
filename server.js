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
    company_name TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  // Tworzenie domyślnego administratora
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultPasswordHash = bcrypt.hashSync(adminPassword, 10);
  
  db.run(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role, company_name) 
          VALUES (?, ?, 'Administrator', 'admin', 'System')`, [adminUsername, defaultPasswordHash]);

  // Tabela firm/klientów
  db.run(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Dodawanie domyślnych firm z гарантированными ID
  db.run(`INSERT OR IGNORE INTO companies (id, name, description) VALUES (1, 'Wolne', 'Nieprzypisane podsieci')`);

  // Tabela podsieci (nowa struktura)
  db.run(`CREATE TABLE IF NOT EXISTS subnets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network TEXT NOT NULL,
    mask INTEGER NOT NULL,
    company_id INTEGER,
    vlan INTEGER,
    description TEXT,
    parent_id INTEGER,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies (id),
    FOREIGN KEY (parent_id) REFERENCES subnets (id)
  )`);

  // Додajemy нове kolumnы до існуючої таблиці podsieci
  db.all("PRAGMA table_info(subnets)", (err, columns) => {
    if (!err) {
      const existingColumns = columns.map(col => col.name);
      
      if (!existingColumns.includes('company_id')) {
        db.run("ALTER TABLE subnets ADD COLUMN company_id INTEGER REFERENCES companies(id)");
      }
      if (!existingColumns.includes('vlan')) {
        db.run("ALTER TABLE subnets ADD COLUMN vlan INTEGER");
      }
      if (!existingColumns.includes('parent_id')) {
        db.run("ALTER TABLE subnets ADD COLUMN parent_id INTEGER REFERENCES subnets(id)");
      }
    }
  });

  // Usuwamy tabelę ip_addresses jeśli istnieje (system teraz pracuje tylko z podsieciami)
  db.run("DROP TABLE IF EXISTS ip_addresses", (err) => {
    if (err) {
      console.log('Informacja: Tabela ip_addresses nie istnieje lub nie można jej usunąć');
    } else {
      console.log('Tabela ip_addresses została usunięta - system teraz pracuje tylko z podsieciami');
    }
  });

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

// Pobranie wszystkich firm
app.get('/api/companies', requireAuth, (req, res) => {
  db.all("SELECT * FROM companies ORDER BY name", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Utworzenie firmy
app.post('/api/companies', requireAuth, (req, res) => {
  const { name, description } = req.body;
  
  db.run("INSERT INTO companies (name, description) VALUES (?, ?)",
    [name, description], function(err) {
      if (err) {
        logAudit(req, 'CREATE_COMPANY_FAILED', 'company', null, null, { name, description, error: err.message });
        res.status(500).json({ error: err.message });
        return;
      }
      
      const companyData = { id: this.lastID, name, description };
      logAudit(req, 'CREATE_COMPANY', 'company', this.lastID, null, companyData);
      res.json(companyData);
    });
});

// Редактирование компании
app.put('/api/companies/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  console.log(`PUT /api/companies/${id}:`, { name, description });
  
  // Проверяем, что это не системная компания
  if (parseInt(id) <= 2) {
    console.log(`Попытка редактирования системной компании ID: ${id}`);
    res.status(400).json({ error: 'Nie można edytować firmy systemowej' });
    return;
  }
  
  db.get("SELECT name FROM companies WHERE id = ?", [id], (err, company) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!company) {
      res.status(404).json({ error: 'Firma nie została znaleziona' });
      return;
    }
    
    if (company.name === 'Wolne') {
      res.status(400).json({ error: 'Nie można edytować firmy systemowej' });
      return;
    }
    
    db.run("UPDATE companies SET name = ?, description = ? WHERE id = ?",
      [name, description, id], function(err) {
        if (err) {
          console.log(`Błąд UPDATE компании ${id}:`, err.message);
          logAudit(req, 'UPDATE_COMPANY_FAILED', 'company', id, null, { name, description, error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        
        console.log(`Компания ${id} успешно обновлена:`, { name, description });
        const companyData = { id: parseInt(id), name, description };
        logAudit(req, 'UPDATE_COMPANY', 'company', id, null, companyData);
        res.json(companyData);
      });
  });
});

// Usuwanie firmy
app.delete('/api/companies/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  console.log(`DELETE /api/companies/${id}`);
  
  // Sprawdzamy, czy to nie firma systemowa
  if (parseInt(id) <= 2) {
    console.log(`Попытка удаления системной компании ID: ${id}`);
    res.status(400).json({ error: 'Nie można usunąć firmy systemowej' });
    return;
  }
  
  db.get("SELECT name FROM companies WHERE id = ?", [id], (err, company) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!company) {
      res.status(404).json({ error: 'Firma nie została znaleziona' });
      return;
    }
    
    if (company.name === 'Wolne') {
      res.status(400).json({ error: 'Nie można usunąć firmy systemowej' });
      return;
    }
    
    // Sprawdzamy, czy firma ma przypisane podsieci
    db.get("SELECT COUNT(*) as count FROM subnets WHERE company_id = ?", [id], (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (result.count > 0) {
        res.status(400).json({ error: 'Nie można usunąć firmy, która ma przypisane podsieci' });
        return;
      }
      
      // Usuwamy firmę
      db.run("DELETE FROM companies WHERE id = ?", [id], function(err) {
        if (err) {
          logAudit(req, 'DELETE_COMPANY_FAILED', 'company', id, null, { error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        
        logAudit(req, 'DELETE_COMPANY', 'company', id, null, { name: company.name });
        res.json({ message: 'Firma została pomyślnie usunięta' });
      });
    });
  });
});

// Pobranie wszystkich podsieci z informacjami o firmach
app.get('/api/subnets', requireAuth, (req, res) => {
  const query = `
    SELECT s.*, c.name as company_name 
    FROM subnets s 
    LEFT JOIN companies c ON s.company_id = c.id 
    ORDER BY s.network, s.mask
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Utworzenie podsieci
app.post('/api/subnets', requireAuth, (req, res) => {
  const { network, mask, company_id, vlan, description } = req.body;
  
  db.run("INSERT INTO subnets (network, mask, company_id, vlan, description) VALUES (?, ?, ?, ?, ?)",
    [network, mask, company_id, vlan, description], function(err) {
      if (err) {
        logAudit(req, 'CREATE_SUBNET_FAILED', 'subnet', null, null, { network, mask, company_id, vlan, description, error: err.message });
        res.status(500).json({ error: err.message });
        return;
      }
      
      const subnetData = { id: this.lastID, network, mask, company_id, vlan, description };
      logAudit(req, 'CREATE_SUBNET', 'subnet', this.lastID, null, subnetData);
      res.json(subnetData);
    });
});

// Edytowanie podsieci
app.put('/api/subnets/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { network, mask, company_id, vlan, description } = req.body;
  
  // Najpierw pobieramy stare wartości
  db.get("SELECT * FROM subnets WHERE id = ?", [id], (err, oldSubnet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run("UPDATE subnets SET network = ?, mask = ?, company_id = ?, vlan = ?, description = ? WHERE id = ?",
      [network, mask, company_id, vlan, description, id], function(err) {
        if (err) {
          logAudit(req, 'UPDATE_SUBNET_FAILED', 'subnet', id, oldSubnet, { network, mask, company_id, vlan, description, error: err.message });
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Podsieć nie została znaleziona' });
          return;
        }
        
        const newSubnet = { id, network, mask, company_id, vlan, description };
        logAudit(req, 'UPDATE_SUBNET', 'subnet', id, oldSubnet, newSubnet);
        res.json({ message: 'Podsieć została zaktualizowana', ...newSubnet });
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
    
    // Usuwamy podsieć
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

// Podziały podsieci - API do rozdzielania podsieci na mniejsze
app.post('/api/subnets/:id/divide', requireAuth, (req, res) => {
  const { id } = req.params;
  const { new_mask } = req.body;
  
  // Pobieramy dane o podsieci rodzicielskiej
  db.get("SELECT * FROM subnets WHERE id = ?", [id], (err, subnet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!subnet) {
      res.status(404).json({ error: 'Podsieć nie została znaleziona' });
      return;
    }
    
    if (new_mask <= subnet.mask) {
      res.status(400).json({ error: 'Nowa maska musi być większa niż aktualna' });
      return;
    }
    
    // Obliczamy liczbę nowych podsieci
    const subnetCount = Math.pow(2, new_mask - subnet.mask);
    const subnetSize = Math.pow(2, 32 - new_mask);
    
    // Konwertujemy adres sieciowy na liczbę
    function ipToNumber(ip) {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }
    
    function numberToIp(num) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
    }
    
    const baseNetwork = ipToNumber(subnet.network);
    const newSubnets = [];
    
    // Tworzymy nowe podsieci
    for (let i = 0; i < subnetCount; i++) {
      const newNetwork = numberToIp(baseNetwork + (i * subnetSize));
      newSubnets.push({
        network: newNetwork,
        mask: new_mask,
        company_id: subnet.company_id,
        vlan: subnet.vlan,
        description: `Podsieć podzielona z ${subnet.network}/${subnet.mask}`,
        parent_id: id
      });
    }
    
    // Zapisujemy nowe podsieci do bazy danych
    const stmt = db.prepare("INSERT INTO subnets (network, mask, company_id, vlan, description, parent_id) VALUES (?, ?, ?, ?, ?, ?)");
    const insertedSubnets = [];
    
    db.serialize(() => {
      newSubnets.forEach((newSubnet, index) => {
        stmt.run([newSubnet.network, newSubnet.mask, newSubnet.company_id, newSubnet.vlan, newSubnet.description, newSubnet.parent_id], function(err) {
          if (!err) {
            insertedSubnets.push({ id: this.lastID, ...newSubnet });
          }
          
          if (index === newSubnets.length - 1) {
            stmt.finalize();
            logAudit(req, 'DIVIDE_SUBNET', 'subnet', id, subnet, { new_mask, created_subnets: insertedSubnets.length });
            res.json({ 
              message: `Podsieć została podzielona na ${insertedSubnets.length} mniejszych podsieci`,
              parent_subnet: subnet,
              new_subnets: insertedSubnets
            });
          }
        });
      });
    });
  });
});

// Łączenie podsieci - API do łączenia sąsiadujących podsieci
app.post('/api/subnets/merge', requireAuth, (req, res) => {
  const { subnet_ids } = req.body;
  
  if (!subnet_ids || subnet_ids.length < 2) {
    res.status(400).json({ error: 'Należy wybrać co najmniej 2 podsieci do połączenia' });
    return;
  }
  
  // Pobieramy dane o podsieci do połączenia
  const placeholders = subnet_ids.map(() => '?').join(',');
  const query = `SELECT * FROM subnets WHERE id IN (${placeholders}) ORDER BY network`;
  
  db.all(query, subnet_ids, (err, subnets) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (subnets.length !== subnet_ids.length) {
      res.status(404).json({ error: 'Nie wszystkie podsieci zostały znalezione' });
      return;
    }
    
    // Sprawdzamy czy wszystkie podsieci mają tę samą maskę
    const firstMask = subnets[0].mask;
    if (!subnets.every(subnet => subnet.mask === firstMask)) {
      res.status(400).json({ error: 'Wszystkie podsieci muszą mieć tę samą maskę' });
      return;
    }
    
    // Sprawdzamy czy podsieci są sąsiadujące
    function ipToNumber(ip) {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }
    
    function numberToIp(num) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
    }
    
    const subnetSize = Math.pow(2, 32 - firstMask);
    const sortedSubnets = subnets.sort((a, b) => ipToNumber(a.network) - ipToNumber(b.network));
    
    // Sprawdzamy ciągłość
    for (let i = 1; i < sortedSubnets.length; i++) {
      const prevEnd = ipToNumber(sortedSubnets[i-1].network) + subnetSize;
      const currentStart = ipToNumber(sortedSubnets[i].network);
      if (prevEnd !== currentStart) {
        res.status(400).json({ error: 'Podsieci muszą być sąsiadujące' });
        return;
      }
    }
    
    // Obliczamy nową podsieć
    const newMask = firstMask - Math.log2(subnets.length);
    if (newMask < 0 || newMask % 1 !== 0) {
      res.status(400).json({ error: 'Nie można połączyć podsieci - nieprawidłowa liczba' });
      return;
    }
    
    const newNetwork = sortedSubnets[0].network;
    const firstSubnet = sortedSubnets[0];
    
    // Tworzymy nową podsieć
    const mergedSubnet = {
      network: newNetwork,
      mask: newMask,
      company_id: firstSubnet.company_id,
      vlan: firstSubnet.vlan,
      description: `Podsieć połączona z ${subnets.length} podsieci`
    };
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Dodajemy nową podsieć
      db.run("INSERT INTO subnets (network, mask, company_id, vlan, description) VALUES (?, ?, ?, ?, ?)",
        [mergedSubnet.network, mergedSubnet.mask, mergedSubnet.company_id, mergedSubnet.vlan, mergedSubnet.description],
        function(err) {
          if (err) {
            db.run("ROLLBACK");
            res.status(500).json({ error: err.message });
            return;
          }
          
          const newSubnetId = this.lastID;
          
          // Usuwamy stare podsieci
          const deletePlaceholders = subnet_ids.map(() => '?').join(',');
          db.run(`DELETE FROM subnets WHERE id IN (${deletePlaceholders})`, subnet_ids, function(err) {
            if (err) {
              db.run("ROLLBACK");
              res.status(500).json({ error: err.message });
              return;
            }
            
            db.run("COMMIT");
            
            logAudit(req, 'MERGE_SUBNETS', 'subnet', newSubnetId, subnets, mergedSubnet);
            res.json({
              message: `Połączono ${subnets.length} podsieci w jedną`,
              merged_subnet: { id: newSubnetId, ...mergedSubnet },
              original_subnets: subnets
            });
          });
        });
    });
  });
});

// Masowe przypisanie wolnych podsieci do firmy
app.post('/api/subnets/assign-free', requireAuth, (req, res) => {
  const { company_id } = req.body;
  
  if (!company_id) {
    res.status(400).json({ error: 'Należy podać ID firmy' });
    return;
  }
  
  // Sprawdzamy czy firma istnieje
  db.get("SELECT * FROM companies WHERE id = ?", [company_id], (err, company) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!company) {
      res.status(404).json({ error: 'Firma nie została znaleziona' });
      return;
    }
    
    // Znajdźemy wszystkie podsieci bez przypisanej firmy (company_id IS NULL lub company_id = 1 "Wolne")
    db.all("SELECT * FROM subnets WHERE company_id IS NULL OR company_id = 1", (err, freeSubnets) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (freeSubnets.length === 0) {
        res.json({ 
          message: 'Brak wolnych podsieci do przypisania',
          assigned_count: 0,
          assigned_subnets: []
        });
        return;
      }
      
      const subnetIds = freeSubnets.map(subnet => subnet.id);
      const placeholders = subnetIds.map(() => '?').join(',');
      
      // Aktualizujemy wszystkie wolne podsieci
      db.run(`UPDATE subnets SET company_id = ? WHERE id IN (${placeholders})`, 
        [company_id, ...subnetIds], function(err) {
          if (err) {
            logAudit(req, 'ASSIGN_FREE_SUBNETS_FAILED', 'subnet', null, null, {
              company_id,
              subnet_count: freeSubnets.length,
              error: err.message
            });
            res.status(500).json({ error: err.message });
            return;
          }
          
          const assignedCount = this.changes;
          
          logAudit(req, 'ASSIGN_FREE_SUBNETS', 'subnet', null, freeSubnets, {
            company_id,
            company_name: company.name,
            assigned_count: assignedCount,
            subnet_ids: subnetIds
          });
          
          res.json({
            message: `Przypisano ${assignedCount} wolnych podsieci do firmy ${company.name}`,
            assigned_count: assignedCount,
            assigned_subnets: freeSubnets.map(subnet => ({
              ...subnet,
              company_id: company_id,
              company_name: company.name
            })),
            company: company
          });
        });
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
    
    // Usuwamy podsieć
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

// Import z Excel - tylko podsieci
app.post('/api/import-excel', requireAuth, upload.single('excelFile'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    let errors = [];
    let companiesCreated = 0;
    
    // Кэш компаний для избежания дублирования запросов
    const companyCache = new Map();

    // Функция для получения или создания компании по имени
    const getOrCreateCompanyByName = (companyName, callback) => {
      if (!companyName || companyName.trim() === '') {
        return callback(null, null);
      }
      
      const normalizedName = companyName.trim();
      
      // Проверяем кэш
      if (companyCache.has(normalizedName)) {
        return callback(null, companyCache.get(normalizedName));
      }
      
      // Ищем существующую компанию
      db.get("SELECT id FROM companies WHERE name = ?", [normalizedName], (err, row) => {
        if (err) {
          return callback(err, null);
        }
        
        if (row) {
          // Компания существует
          companyCache.set(normalizedName, row.id);
          return callback(null, row.id);
        }
        
        // Создаем новую компанию
        db.run("INSERT INTO companies (name, description) VALUES (?, ?)", 
          [normalizedName, `Firma utworzona podczas importu`], 
          function(err) {
            if (err) {
              return callback(err, null);
            }
            companiesCreated++;
            companyCache.set(normalizedName, this.lastID);
            callback(null, this.lastID);
          });
      });
    };

    // Функция для создания компании с определенным ID
    const createCompanyWithId = (companyId, companyName, callback) => {
      if (!companyName || companyName.trim() === '') {
        return callback(null, companyId);
      }
      
      const normalizedName = companyName.trim();
      
      // Защита системных компаний от перезаписи
      if (companyId <= 2) {
        return callback(new Error(`Nie można modyfikować systemowej firmy (ID: ${companyId})`), null);
      }
      
      // Проверяем, существует ли уже компания с таким ID
      db.get("SELECT id, name FROM companies WHERE id = ?", [companyId], (err, row) => {
        if (err) {
          return callback(err, null);
        }
        
        if (row) {
          // Компания с таким ID уже существует
          if (row.name !== normalizedName) {
            // Обновляем название, если оно отличается
            db.run("UPDATE companies SET name = ?, description = ? WHERE id = ?", 
              [normalizedName, `Firma zaktualizowana podczas importu`, companyId], 
              (updateErr) => {
                if (updateErr) {
                  return callback(updateErr, null);
                }
                companyCache.set(normalizedName, companyId);
                callback(null, companyId);
              });
          } else {
            companyCache.set(normalizedName, companyId);
            callback(null, companyId);
          }
        } else {
          // Создаем новую компанию с определенным ID
          db.run("INSERT INTO companies (id, name, description) VALUES (?, ?, ?)", 
            [companyId, normalizedName, `Firma utworzona podczas importu`], 
            function(insertErr) {
              if (insertErr) {
                return callback(insertErr, null);
              }
              companiesCreated++;
              companyCache.set(normalizedName, companyId);
              callback(null, companyId);
            });
        }
      });
    };

    // Обрабатываем каждую строку
    let processedRows = 0;
    const totalRows = data.length;

    data.forEach((row, index) => {
      // Поддерживаем как польские, так и английские названия колонок
      const network = row.network || row['Sieć'];
      const mask = row.mask || row['Maska'];
      const company = row.company || row['Firma'] || row.company_name;
      const company_id = row.company_id;
      const name = row.name;
      const vlan = row.vlan || row['VLAN'];
      const description = row.description || row['Opis'];
      
      if (!network || !mask) {
        errors.push(`Wiersz ${index + 1}: Brak wymaganych danych (sieć i maska)`);
        processedRows++;
        if (processedRows === totalRows) {
          sendResponse();
        }
        return;
      }

      // Определяем способ обработки компании
      let companyHandler;
      
      if (company_id && name) {
        // Если указаны и company_id, и name - создаем/обновляем компанию с конкретным ID
        companyHandler = (callback) => createCompanyWithId(parseInt(company_id), name, callback);
      } else if (company) {
        // Если указана только company (старый формат) - создаем компанию с автоматическим ID
        companyHandler = (callback) => getOrCreateCompanyByName(company, callback);
      } else if (company_id) {
        // Если указан только company_id - используем существующую компанию
        companyHandler = (callback) => callback(null, parseInt(company_id));
      } else {
        // Если ничего не указано - подсеть будет свободной
        companyHandler = (callback) => callback(null, null);
      }

      companyHandler((err, finalCompanyId) => {
        if (err) {
          errors.push(`Wiersz ${index + 1}: Błąd firmy: ${err.message}`);
          processedRows++;
          if (processedRows === totalRows) {
            sendResponse();
          }
          return;
        }

        db.run(`INSERT OR IGNORE INTO subnets 
                (network, mask, company_id, vlan, description) 
                VALUES (?, ?, ?, ?, ?)`,
          [network, parseInt(mask), finalCompanyId, vlan || null, description || ''],
          function(insertErr) {
            if (insertErr) {
              errors.push(`Wiersz ${index + 1}: ${insertErr.message}`);
            } else if (this.changes > 0) {
              imported++;
            }
            
            processedRows++;
            if (processedRows === totalRows) {
              sendResponse();
            }
          });
      });
    });

    const sendResponse = () => {
      // Logujemy import
      logAudit(req, 'IMPORT_EXCEL', 'subnet', null, null, { 
        filename: req.file.originalname, 
        imported_count: imported, 
        companies_created: companiesCreated,
        total_rows: data.length,
        errors_count: errors.length 
      });
      
      let message = `Zaimportowano ${imported} podsieci`;
      if (companiesCreated > 0) {
        message += ` i utworzono ${companiesCreated} nowych firm`;
      }
      
      res.json({ 
        message: message, 
        errors: errors,
        stats: {
          imported_subnets: imported,
          created_companies: companiesCreated,
          total_rows: data.length
        }
      });
    };

    // Если нет данных для обработки
    if (totalRows === 0) {
      sendResponse();
    }

  } catch (error) {
    logAudit(req, 'IMPORT_EXCEL_FAILED', 'subnet', null, null, { error: error.message });
    res.status(500).json({ error: 'Błąd podczas przetwarzania pliku Excel' });
  }
});

// Eksport podsieci do Excel
app.get('/api/export-excel', requireAuth, (req, res) => {
  const query = `
    SELECT s.network, s.mask, s.company_id, s.vlan, s.description, s.created_date,
           c.name as company_name
    FROM subnets s 
    LEFT JOIN companies c ON s.company_id = c.id 
    ORDER BY s.network, s.mask
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      // Konwertujemy dane do formatu Excel
      const exportData = rows.map(row => ({
        'network': row.network,
        'mask': row.mask,
        'company_id': row.company_id || '',
        'vlan': row.vlan || '',
        'description': row.description || '',
        'name': row.company_name || ''
      }));
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dane');
      
      const fileName = `export_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.xlsx`;
      const filePath = path.join(__dirname, 'uploads', fileName);
      
      XLSX.writeFile(workbook, filePath);
      
      logAudit(req, 'EXPORT_EXCEL', 'subnet', null, null, { 
        filename: fileName, 
        exported_count: rows.length 
      });
      
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Błąd podczas pobierania pliku:', err);
        }
        // Usuwamy plik po pobraniu
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('Błąd podczas usuwania pliku:', unlinkErr);
        });
      });
      
    } catch (error) {
      logAudit(req, 'EXPORT_EXCEL_FAILED', 'subnet', null, null, { error: error.message });
      res.status(500).json({ error: 'Błąd podczas tworzenia pliku Excel' });
    }
  });
});

// Pobranie logów audytu
app.get('/api/audit-logs', requireAuth, (req, res) => {
  const { page = 1, limit = 50, action, entity_type, username, date_from, date_to } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
  let params = [];
  
  if (action) {
    query += ` AND action = ?`;
    countQuery += ` AND action = ?`;
    params.push(action);
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
  
  if (date_from) {
    query += ` AND DATE(created_date) >= ?`;
    countQuery += ` AND DATE(created_date) >= ?`;
    params.push(date_from);
  }
  
  if (date_to) {
    query += ` AND DATE(created_date) <= ?`;
    countQuery += ` AND DATE(created_date) <= ?`;
    params.push(date_to);
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

// Statystyki - tylko podsieci
app.get('/api/stats', requireAuth, (req, res) => {
  // Получаем общую статистику
  db.get(`SELECT COUNT(*) as total_subnets FROM subnets`, (err, totalResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Получаем количество свободных подсетей (company_id = 2 или NULL)
    db.get(`SELECT COUNT(*) as free_subnets FROM subnets WHERE company_id = 1 OR company_id IS NULL`, (err, freeResult) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Получаем количество компаний
      db.get(`SELECT COUNT(*) as total_companies FROM companies`, (err, companiesResult) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const total_subnets = totalResult.total_subnets || 0;
        const free_subnets = freeResult.free_subnets || 0;
        const assigned_subnets = total_subnets - free_subnets;
        const total_companies = companiesResult.total_companies || 0;
        
        res.json({
          total_subnets,
          free_subnets,
          assigned_subnets,
          total_companies
        });
      });
    });
  });
});

// Аналитyка - ogólna statystyka podsieci
app.get('/api/analytics/stats', requireAuth, (req, res) => {
  const { company_id, date_from, date_to } = req.query;
  
  let whereClause = "WHERE 1=1";
  let params = [];
  
  if (company_id) {
    whereClause += " AND s.company_id = ?";
    params.push(company_id);
  }
  
  if (date_from) {
    whereClause += " AND s.created_date >= ?";
    params.push(date_from);
  }
  
  if (date_to) {
    whereClause += " AND s.created_date <= ?";
    params.push(date_to + ' 23:59:59');
  }

  // Получаем общую статистику с фильтрами
  db.get(`SELECT COUNT(*) as total_subnets FROM subnets s ${whereClause}`, params, (err, totalResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Получаем количество свободных подсетей (только с company_id = NULL)
    let freeParams = [...params];
    let freeWhere = whereClause + " AND s.company_id IS NULL";
    
    db.get(`SELECT COUNT(*) as free_subnets FROM subnets s ${freeWhere}`, freeParams, (err, freeResult) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Получаем распределение VLAN
      db.all(`SELECT 
        COALESCE(s.vlan, 'Brak') as vlan, 
        COUNT(*) as count 
        FROM subnets s ${whereClause} 
        GROUP BY s.vlan 
        ORDER BY count DESC`, params, (err, vlanResult) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const total_subnets = totalResult.total_subnets || 0;
        const free_subnets = freeResult.free_subnets || 0;
        const assigned_subnets = total_subnets - free_subnets;
        
        // Получаем количество компаний (исключая технические)
        db.get(`SELECT COUNT(*) as total_companies FROM companies WHERE name != 'Wolne'`, (err, companiesResult) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          res.json({
            total_subnets,
            free_subnets,
            assigned_subnets,
            total_companies: companiesResult.total_companies || 0,
            vlan_distribution: vlanResult || []
          });
        });
      });
    });
  });
});

// Аналитика - podsieci według firm
app.get('/api/analytics/companies', requireAuth, (req, res) => {
  const { date_from, date_to } = req.query;
  
  let query = `SELECT 
    COALESCE(c.name, 'Wolne') as company,
    COUNT(s.id) as subnet_count,
    c.id as company_id
    FROM subnets s
    LEFT JOIN companies c ON s.company_id = c.id
    WHERE 1=1`;
  
  let params = [];
  
  if (date_from) {
    query += " AND s.created_date >= ?";
    params.push(date_from);
  }
  
  if (date_to) {
    query += " AND s.created_date <= ?";
    params.push(date_to + ' 23:59:59');
  }
  
  query += " GROUP BY c.id, c.name ORDER BY subnet_count DESC LIMIT 10";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Аналитика - aktywność podsieci według miesięcy
app.get('/api/analytics/monthly', requireAuth, (req, res) => {
  const { company_id } = req.query;
  
  let query = `SELECT 
    strftime('%Y-%m', s.created_date) as month,
    COUNT(*) as count
    FROM subnets s
    WHERE s.created_date >= date('now', '-12 months')`;
  
  let params = [];
  
  if (company_id) {
    query += " AND s.company_id = ?";
    params.push(company_id);
  }
  
  query += " GROUP BY strftime('%Y-%m', s.created_date) ORDER BY month";
  
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

// Import firm z Excel
// Eksport firm do Excel
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

