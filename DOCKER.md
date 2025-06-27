# Docker Setup dla System Zarządzania Adresami IP

## 🐳 Szybki start z Docker

### Opcja 1: Docker Compose (zalecane)

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
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin123 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  ip-management-system
```

## 📋 Konfiguracja zmiennych środowiskowych

Skopiuj `.env.docker` do `.env` i dostosuj do swoich potrzeb:

```bash
cp .env.docker .env
```

Główne zmienne:
- `ADMIN_USERNAME` - login administratora
- `ADMIN_PASSWORD` - hasło administratora  
- `SESSION_SECRET` - sekretny klucz dla sesji (koniecznie zmień!)
- `NODE_ENV` - środowisko (production/development)

## 🗂️ Struktura wolumenów

- `./data:/app/data` - baza danych SQLite
- `./uploads:/app/uploads` - przesłane pliki
- `./backups:/backup/output` - kopie zapasowe (opcjonalnie)

## 🔧 Przydatne komendy NPM

```bash
# Docker Compose
npm run docker:compose:up     # Uruchomienie z compose
npm run docker:compose:down   # Zatrzymanie compose
npm run docker:compose:logs   # Podgląd logów
npm run docker:compose:build  # Przebudowa obrazów
npm run docker:compose:ps     # Status kontenerów
npm run docker:compose:restart # Restart kontenerów

# Zwykły Docker
npm run docker:build          # Budowanie obrazu
npm run docker:run           # Uruchomienie kontenera
npm run docker:stop          # Zatrzymanie kontenera
npm run docker:remove        # Usunięcie kontenera
```

## 🌐 Dostęp do aplikacji

Po uruchomieniu aplikacja będzie dostępna pod adresem:
- http://localhost:3000
- http://your-server-ip:3000

**Dane do logowania:**
- Login: admin (lub wartość z ADMIN_USERNAME)
- Hasło: admin123 (lub wartość z ADMIN_PASSWORD)

## 🔒 Bezpieczeństwo

1. **Koniecznie zmień domyślne hasła!**
2. Używaj silnego `SESSION_SECRET`
3. Przy wdrażaniu w produkcji skonfiguruj firewall
4. Rozważ użycie reverse proxy (nginx) z SSL

## 📦 Kopie zapasowe

Docker Compose zawiera automatyczny serwis kopii zapasowych:
- Tworzy kopie zapasowe co 24 godziny
- Zapisuje w folderze `./backups/`
- Automatycznie usuwa stare kopie zapasowe (>30 dni)

Ręczne tworzenie kopii zapasowej:
```bash
docker exec ip-management-backup tar -czf /backup/output/manual-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /backup data
```

## 🔧 Rozwiązywanie problemów

### Sprawdzanie statusu kontenerów:
```bash
docker compose ps
# lub
sudo docker ps -a
```

### Podgląd logów:
```bash
docker compose logs ip-management
# lub dla wszystkich serwisów
docker compose logs -f
```

### Połączenie z kontenerem:
```bash
docker exec -it ip-management-system sh
```

### Sprawdzanie wolumenów:
```bash
docker volume ls
```

## 📊 Monitoring

Dla środowiska produkcyjnego zaleca się dodanie monitoringu:
- Health checks
- Agregacja logów
- Monitoring wydajności
- Alerty

Przykład health check można dodać w Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth-status || exit 1
```
