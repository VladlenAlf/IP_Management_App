# System Zarządzania Podsieciami

Nowoczesny system internetowy do zarządzania podsieciami sieciowymi z interfejsem w języku polskim.

## 🚀 Funkcje

- **Zarządzanie podsieciami** - Tworzenie, edycja, usuwanie i podział podsieci
- **Zarządzanie firmami** - Przypisywanie podsieci do firm i organizacji
- **Masowe operacje** - Łączenie, dzielenie i masowe przypisywanie podsieci
- **Import/Eksport Excel** - Pełna obsługa importu i eksportu danych
- **Analityka zaawansowana** - Wykresy wykorzystania podsieci, statystyki VLAN i firm
- **Historia podsieci** - Pełne śledzenie zmian i historii każdej podsieci
- **Logi audytu** - Szczegółowe logowanie wszystkich operacji w systemie
- **Kalkulator IP** - Wbudowane narzędzie do obliczeń sieciowych
- **Autoryzacja** - Bezpieczne logowanie z hashowaniem haseł
- **Dostęp w sieci** - Możliwość korzystania z różnych urządzeń w sieci lokalnej

## 📦 Instalacja

### Wymagania
- Node.js (wersja 16 lub nowsza)
- npm
- SQLite3

### Kroki instalacji

1. **Sklonuj repozytorium**
```bash
git clone <url-repozytorium>
cd system-zarzadzania-ip
```

2. **Zainstaluj zależności**
```bash
npm install
```

3. **Konfiguracja**
Skopiuj plik `.env.example` na `.env` i dostosuj ustawienia:
```bash
cp .env.example .env
```

Edytuj plik `.env` aby ustawić własne dane logowania:
```
ADMIN_USERNAME=admin1234
ADMIN_PASSWORD=admin1234
NODE_ENV=production
SESSION_SECRET=your-secret-key-here
```

4. **Uruchom serwer**
```bash
npm start
```

### Dostępne komendy

```bash
# Uruchomienie serwera lokalnie
npm start

# Uruchomienie z dostępem z sieci
npm run network

# Tryb developera (automatyczne restartowanie)
npm run dev

# Tryb developera z dostępem z sieci
npm run network:dev

# Informacje o sieci
npm run info

# Docker commands
npm run docker:build
npm run docker:compose:up
npm run docker:compose:down
```

## 🐳 Docker

System obsługuje uruchamianie w kontenerach Docker:

```bash
# Pierwsza instalacja lub pełne odtworzenie
npm run docker:restart

# Alternatywnie ręcznie:
# Uruchomienie z Docker Compose (zalecane)
docker compose up -d

# Podgląd logów
docker compose logs -f

# Zatrzymanie
docker compose down

# Przebudowa bez kэша (gdy zmiany w kodzie)
docker compose build --no-cache && docker compose up -d
```

**⚠️ Ważne dla deweloperów:**
Jeśli wprowadzasz zmiany w kodzie, zawsze używaj `npm run docker:restart` lub `docker compose build --no-cache` aby Docker nie używał starego kэша obrazu.

## 🌐 Dostęp

### Lokalny dostęp
- http://localhost:3000
- http://127.0.0.1:3000

### Dostęp z sieci lokalnej
Po uruchomieniu system automatycznie wykrywa dostępne adresy IP i wyświetla je w konsoli.

### Dane logowania
- **Login**: admin1234 (lub wartość z ADMIN_USERNAME)
- **Hasło**: admin1234 (lub wartość z ADMIN_PASSWORD)

## 🛠️ Użytkowanie

### Zarządzanie podsieciami
1. Przejdź do zakładki "Podsieci"
2. Kliknij "Dodaj podsieć" lub użyj masowych operacji
3. Wprowadź adres sieci w formacie CIDR (np. 192.168.1.0/24)
4. Przypisz do firmy (opcjonalnie)
5. Dodaj VLAN i opis

**Dostępne operacje:**
- **Podziel** - Dzieli podsieć na mniejsze podsieci
- **Usuń** - Usuwa podsieć z systemu
- **Łącz** - Łączy zaznaczone podsieci (jeśli to możliwe)
- **Filtrowanie** - Wyszukiwanie po IP, VLAN, firmie

### Zarządzanie firmami
1. Przejdź do zakładki "Firmy"
2. Dodawaj, edytuj i usuwaj firmy
3. Przypisuj podsieci do firm
4. Przeglądaj statystyki wykorzystania

### Import/Eksport Excel

**Eksport:**
- Przejdź do "Import/Eksport" → "Pobierz dane (Excel)"
- Plik zawiera kolumny: Sieć, Maska, ID Firmy, VLAN, Opis, Firma

**Import:**
- Obsługiwane formaty: .xlsx, .xls
- Wymagane kolumny: `Sieć` (lub `network`), `Maska` (lub `mask`)
- Opcjonalne: `Firma`, `VLAN`, `Opis`, `ID Firmy`

### Analityka
Zakładka "Analityka" oferuje:
- **Wykorzystanie podsieci** - Wykres kołowy aktywnych/nieaktywnych
- **Firmy według podsieci** - Ranking firm
- **Rozkład VLAN** - Statystyki wykorzystania VLAN
- **Filtry** - Według firm, dat, VLAN

### Historia podsieci
1. Przejdź do zakładki "Historia podsieci"
2. Przeglądaj wszystkie podsieci (aktywne i usunięte)
3. Kliknij "Historia" przy podsieci dla szczegółów
4. Eksportuj historię do CSV

### Logi audytu
Wszystkie operacje są automatycznie logowane z:
- Dokładną datą i czasem
- Informacjami o użytkowniku
- Szczegółami przed/po zmianie
- Adresem IP użytkownika
- User Agent przeglądarki

### Kalkulator IP
1. Przejdź do zakładki "Kalkulator IP"
2. Wprowadź adres IP i maskę
3. Otrzymaj informacje o:
   - Adresie sieciowym
   - Adresie broadcast
   - Liczbie hostów
   - Klasie sieci
   - Typie sieci (publiczna/prywatna)

## 🔧 Struktura systemu

### Struktura plików
```
├── app.js              # Aplikacja frontendowa (główna logika)
├── server.js           # Serwer Node.js z API
├── index.html          # Główna strona aplikacji
├── login.html          # Strona logowania
├── styles.css          # Arkusze stylów
├── config/
│   └── network.js      # Konfiguracja sieci i bezpieczeństwa
├── scripts/
│   └── network-info.js # Skrypt informacji o sieci
├── data/
│   └── ip_management.db # Baza danych SQLite
├── uploads/            # Folder na przesłane pliki
├── backups/           # Automatyczne kopie zapasowe (Docker)
├── docker-compose.yml # Konfiguracja Docker
├── Dockerfile         # Definicja obrazu Docker
└── .env               # Zmienne środowiskowe
```

### Baza danych
System używa SQLite z następującymi tabelami:
- **subnets** - Podsieci (network, mask, company_id, vlan, description)
- **companies** - Firmy (name, description)
- **audit_logs** - Logi audytu (action, user, changes)
- **users** - Użytkownicy (username, password_hash)

## 🌟 Funkcje sieciowe

- Automatyczne wykrywanie interfejsów sieciowych
- Bezpieczne sesje dla wielu urządzeń
- CORS skonfigurowany dla sieci lokalnych (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Walidacja i normalizacja adresów sieciowych
- Sprawdzanie konfliktów podsieci

## 🔒 Bezpieczeństwo

- **Hashowanie haseł** bcrypt z salt
- **Sesje** z HttpOnly cookies i CSRF protection
- **Autoryzacja** na wszystkich endpoint API
- **Logi audytu** wszystkich operacji
- **Walidacja danych** wejściowych
- **Rate limiting** dla produkcji

## 📱 Interface

- **Responsywny design** - działa na wszystkich urządzeniach
- **Intuicyjne filtry** - szybkie wyszukiwanie i filtrowanie
- **Podpowiedzi IP** - inteligentne wyszukiwanie po adresach
- **Powiadomienia** - informacje o sukcesach i błędach
- **Paginacja** - wydajne przeglądanie dużych zbiorów danych

## 🛡️ Kopie zapasowe

W trybie Docker automatyczne kopie zapasowe:
- Tworzenie co 24 godziny
- Przechowywanie w folderze `./backups/`
- Automatyczne usuwanie kopii starszych niż 30 dni

## 🐛 Rozwiązywanie problemów

### Problemy z połączeniem
```bash
# Sprawdź dostępne adresy IP
npm run info

# Uruchom w trybie sieciowym
npm run network

# Sprawdź status portów
netstat -an | grep 3000
```

### Resetowanie danych
```bash
# Usuń bazę danych (zostanie utworzona ponownie)
rm -f data/ip_management.db

# Wyczyść upload
rm -rf uploads/*
```

### Problemy z Docker
```bash
# Jeśli Docker używa starej wersji kodu:
npm run docker:restart

# Restart kontenerów
docker compose restart

# Sprawdź logi
docker compose logs

# Przebuduj obrazy (gdy nic nie pomaga)
docker compose build --no-cache

# Wyczyść wszystko i zacznij od nowa
docker compose down
docker image prune -a
docker compose up -d --build
```

**Najczęstsze problemy:**
- **Stara wersja kodu w Docker**: Użyj `npm run docker:restart`
- **Problemy z bazą danych**: Sprawdź czy folder `./data` ma odpowiednie uprawnienia
- **Port 3000 zajęty**: Zatrzymaj inne procesy lub zmień port w docker-compose.yml
- **Problemy z dostępem**: Sprawdź czy firewall nie blokuje portu 3000

## 📊 Wydajność

System został zoptymalizowany dla:
- **Średnie obciążenie**: 100-1000 podsieci
- **Duże obciążenie**: Powyżej 1000 podsieci (zalecane indeksowanie)
- **Pamięć**: ~50MB RAM
- **Dysk**: ~10MB + dane użytkownika

## 🔄 Migracja z starszych wersji

System automatycznie usuwa nieużywane tabele `ip_addresses` przy starcie.
Wszystkie dane podsieci są zachowywane.

## 📄 Licencja

Apache License

## 🤝 Wsparcie

- **Dokumentacja**: Ten plik README
- **Logi**: Sprawdź logi serwera i audit_logs w bazie
- **Issues**: Utwórz issue w repozytorium
- **Docker**: Zobacz DOCKER.md dla szczegółów Docker

## 🆕 Changelog

### v2.0.0 (Aktualna)
- ✅ Przeprojektowanie z IP na podsieci
- ✅ Dodanie historii podsieci
- ✅ Zaawansowana analityka
- ✅ Kalkulator IP
- ✅ Poprawa eksportu/importu Excel
- ✅ Filtrowanie i wyszukiwanie
- ✅ Operacje masowe na podsieciach
- ✅ Pełna obsługa Docker

### v1.x
- Zarządzanie pojedynczymi adresami IP (deprecated)
