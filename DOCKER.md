# Docker Setup dla System Zarządzania Podsieciami

## 🐳 Szybki start z Docker

### ⚡ Najszybszy sposób (zalecane)

```bash
# Pełna instalacja z czyszczeniem kэша
npm run docker:restart
```

### Opcja 1: Docker Compose (standardowy sposób)

1. **Uruchomienie aplikacji:**
```bash
docker compose up -d
```

2. **Podgląd logów:**
```bash
docker compose logs -f
```

3. **Zatrzymanie:**
```bash
docker compose down
```

4. **Sprawdzenie statusu:**
```bash
docker compose ps
```

⚠️ **Ważne:** Jeśli wprowadzasz zmiany w kodzie, użyj `npm run docker:restart` lub `docker compose build --no-cache`

### Opcja 2: Docker bez Compose

1. **Budowanie obrazu:**
```bash
docker build -t ip-management-system .
```

2. **Uruchomienie kontenera:**
```bash
docker run -d \
  --name ip-management \
  -p 3000:3000 \
  -e ADMIN_USERNAME=admin1234 \
  -e ADMIN_PASSWORD=admin1234 \
  -e SESSION_SECRET=your-secret-key-here \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  ip-management-system
```

## 📋 Konfiguracja zmiennych środowiskowych

Skopiuj `.env.example` do `.env` i dostosuj do swoich potrzeb:

```bash
cp .env.example .env
```

Główne zmienne w pliku `.env`:
- `ADMIN_USERNAME=admin1234` - login administratora (zmień na swój!)
- `ADMIN_PASSWORD=admin1234` - hasło administratora (zmień na swoje!)
- `SESSION_SECRET` - sekretny klucz dla sesji (koniecznie zmień na losowy!)
- `NODE_ENV=production` - środowisko (production/development)
- `HOST=0.0.0.0` - host serwera (dla Docker zawsze 0.0.0.0)
- `PORT=3000` - port serwera

## 🗂️ Struktura wolumenów

- `./data:/app/data` - baza danych SQLite (podsieci, firmy, użytkownicy)
- `./uploads:/app/uploads` - przesłane pliki Excel
- `./backups:/backup/output` - automatyczne kopie zapasowe

## 🔧 Przydatne komendy NPM

```bash
# Główne komendy Docker
npm run docker:restart       # PEŁNY restart z czyszczeniem kэша (zalecane)
npm run docker:compose:up    # Uruchomienie z compose
npm run docker:compose:down  # Zatrzymanie compose
npm run docker:compose:logs  # Podgląd logów
npm run docker:compose:build # Przebudowa obrazów bez kэша
npm run docker:compose:ps    # Status kontenerów
npm run docker:compose:restart # Restart kontenerów

# Zwykły Docker
npm run docker:build         # Budowanie obrazu
npm run docker:run          # Uruchomienie kontenera
npm run docker:stop         # Zatrzymanie kontenera
npm run docker:remove       # Usunięcie kontenera
```

## 🌐 Dostęp do aplikacji

Po uruchomieniu aplikacja będzie dostępna pod adresem:
- http://localhost:3000
- http://your-server-ip:3000

**Aktualne dane do logowania:**
- Login: **admin1234** (lub wartość z ADMIN_USERNAME)
- Hasło: **admin1234** (lub wartość z ADMIN_PASSWORD)

## � Funkcje systemu w Docker

System w Docker zawiera wszystkie funkcje:
- ✅ **Zarządzanie podsieciami** - CIDR, podział, łączenie
- ✅ **Zarządzanie firmami** - przypisywanie, statystyki
- ✅ **Import/Eksport Excel** - pełna obsługa plików
- ✅ **Historia podsieci** - śledzenie zmian
- ✅ **Analityka** - wykresy i statystyki
- ✅ **Logi audytu** - szczegółowe logowanie
- ✅ **Kalkulator IP** - narzędzie sieciowe
- ✅ **Automatyczne backupy** - kopie zapasowe

## �🔒 Bezpieczeństwo

1. **Конiecznie zmień domyślne hasła!**
   ```bash
   # W pliku .env
   ADMIN_USERNAME=your_username
   ADMIN_PASSWORD=your_strong_password
   SESSION_SECRET=very-long-random-string-here
   ```

2. **Używaj silnego `SESSION_SECRET`** (min. 32 znaki)
3. **Przy wdrażaniu w produkcji:**
   - Skonfiguruj firewall (port 3000)
   - Używaj reverse proxy (nginx) z SSL
   - Monitoruj logi aplikacji

## 📦 Kopie zapasowe

Docker Compose zawiera automatyczny serwis kopii zapasowych:
- **Częstotliwość:** co 24 godziny
- **Lokalizacja:** folder `./backups/`
- **Retencja:** automatyczne usuwanie kopii starszych niż 30 dni
- **Format:** tar.gz z datą w nazwie

### Ręczne operacje backup:

```bash
# Ręczne tworzenie kopii zapasowej
docker exec ip-management-backup tar -czf /backup/output/manual-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /backup data

# Przywracanie z kopii zapasowej
docker compose down
tar -xzf backups/backup-YYYYMMDD_HHMMSS.tar.gz
docker compose up -d

# Lista wszystkich kopii zapasowych
ls -la backups/
```

## 🔧 Rozwiązywanie problemów

### Problem: Docker używa starej wersji kodu
```bash
# Rozwiązanie - pełny restart z czyszczeniem
npm run docker:restart

# Lub manualnie:
docker compose down
docker image rm asdasd-ip-management 2>/dev/null || true
docker compose build --no-cache
docker compose up -d
```

### Problem: Błędy dostępu do bazy danych
```bash
# Sprawdź uprawnienia do folderów
chmod 755 data/ uploads/ backups/

# Sprawdź czy kontenery działają
docker compose ps

# Sprawdź logi błędów
docker compose logs ip-management
```

### Problem: Port 3000 jest zajęty
```bash
# Sprawdź co używa portu
netstat -tulpn | grep :3000
# lub
lsof -i :3000

# Zatrzymaj konfliktujący proces lub zmień port w docker-compose.yml
```

### Diagnostyka ogólna:

```bash
# Status kontenerów
docker compose ps

# Szczegółowe logi
docker compose logs ip-management

# Logi backup serwisu
docker compose logs backup

# Połączenie z kontenerem (debugowanie)
docker exec -it ip-management-system sh

# Sprawdzenie wolumenów
docker volume ls

# Sprawdzenie sieci Docker
docker network ls
```

### Problemy z wydajnością:
```bash
# Sprawdź użycie zasobów
docker stats ip-management-system

# Wyczyść niewykorzystane obiekty Docker
docker system prune -f

# Sprawdź miejsce na dysku
df -h
du -sh data/ uploads/ backups/
```

## 📊 Monitoring i Health Checks

System zawiera wbudowane health checks:

```bash
# Sprawdź czy API odpowiada
curl -f http://localhost:3000/api/auth-status

# Sprawdź status w Docker
docker compose ps
```

Dla produkcji zaleca się dodanie zewnętrznego monitoringu:
- **Uptime monitoring** (Uptime Robot, Pingdom)
- **Log aggregation** (ELK Stack, Grafana)
- **Resource monitoring** (Prometheus + Grafana)

## 🚢 Wdrażanie w produkcji

### 1. Przygotowanie serwera
```bash
# Instalacja Docker i Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Instalacja Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Konfiguracja produkcyjna
```bash
# Klonowanie repozytorium
git clone <repository-url>
cd system-zarzadzania-ip

# Konfiguracja środowiska
cp .env.example .env
nano .env  # Edytuj dane logowania i SECRET

# Uruchomienie
npm run docker:restart
```

### 3. Konfiguracja reverse proxy (opcjonalnie)
Przykład nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🆕 Migracja z poprzedniej wersji

Jeśli masz starą wersję systemu:

```bash
# 1. Zatrzymaj starą wersję
docker compose down

# 2. Wykonaj backup
cp -r data/ data_backup_$(date +%Y%m%d)

# 3. Pobierz nową wersję
git pull origin main

# 4. Uruchom nową wersję
npm run docker:restart

# 5. Sprawdź logi
docker compose logs -f
```

System automatycznie:
- Usuwa nieużywane tabele `ip_addresses`
- Zachowuje wszystkie dane podsieci i firm
- Aktualizuje strukturę bazy danych

## 📞 Wsparcie

- **Dokumentacja:** README.md w głównym katalogu
- **Logi aplikacji:** `docker compose logs ip-management`
- **Logi backup:** `docker compose logs backup`
- **Baza danych:** SQLite w `./data/ip_management.db`
- **Pliki uploadów:** `./uploads/`

Dla zaawansowanych problemów sprawdź sekcję troubleshooting w README.md
