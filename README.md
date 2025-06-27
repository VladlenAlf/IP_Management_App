# System Zarządzania Adresami IP

Nowoczesny system internetowy do zarządzania adresami IP z interfejsem w języku polskim.

## 🚀 Funkcje

- **Zarządzanie adresami IP** - Dodawanie, edycja, usuwanie adresów IP
- **Zarządzanie podsieciami** - Tworzenie i zarządzanie podsieciami
- **Masowe operacje** - Dodawanie i usuwanie wielu adresów IP jednocześnie
- **Import z Excel** - Importowanie danych z plików Excel
- **Analityka** - Szczegółowe wykresy i statystyki wykorzystania
- **Logi audytu** - Pełne śledzenie wszystkich operacji w systemie
- **Autoryzacja** - Bezpieczne logowanie użytkowników
- **Dostęp w sieci** - Możliwość korzystania z różnych urządzeń w sieci lokalnej

## 📦 Instalacja

### Wymagania
- Node.js (wersja 14 lub nowsza)
- npm

### Kroki instalacji

1. **Sklonuj repozytorium**
```bash
git clone <url-repozytorium>
cd ip-management-system
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
ADMIN_USERNAME=twoj_login
ADMIN_PASSWORD=twoje_haslo
NODE_ENV=production
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
```

## 🌐 Dostęp

### Lokalny dostęp
- http://localhost:3000
- http://127.0.0.1:3000

### Dostęp z sieci lokalnej
Po uruchomieniu z `npm run network` system będzie dostępny z innych urządzeń w sieci lokalnej.

### Dane logowania
- **Login**: admin
- **Hasło**: admin123

## 🛠️ Użytkowanie

### Zarządzanie adresami IP
1. Przejdź do zakładki "Adresy IP"
2. Kliknij "Dodaj IP" lub użyj funkcji masowego dodawania
3. Wypełnij formularz z danymi adresu
4. Zapisz zmiany

### Zarządzanie podsieciami
1. Przejdź do zakładki "Podsieci"
2. Kliknij "Dodaj podsieć"
3. Wprowadź adres sieci i maskę
4. Dodaj opis (opcjonalnie)

### Import z Excel
1. Przejdź do zakładki "Import/Eksport"
2. Wybierz plik Excel (.xlsx lub .xls)
3. Kliknij "Importuj"

Obsługiwane kolumny:
- ip_address (wymagane)
- company_name
- assigned_date
- is_occupied (1 lub 0)
- description

### Analityka
Zakładka "Analityka" oferuje:
- Wykresy wykorzystania IP
- Statystyki według podsieci
- Ranking firm według wykorzystania
- Aktywność w czasie

### Logi audytu
Wszystkie operacje są śledzone i zapisywane w logach z:
- Datą i czasem operacji
- Informacjami o użytkowniku
- Szczegółami zmiany
- Adresem IP użytkownika

## 🔧 Konfiguracja

System automatycznie tworzy bazę danych SQLite przy pierwszym uruchomieniu.

### Struktura plików
```
├── app.js              # Aplikacja frontendowa
├── server.js           # Serwer Node.js
├── index.html          # Główna strona
├── login.html          # Strona logowania
├── styles.css          # Arkusze stylów
├── config/
│   └── network.js      # Konfiguracja sieci
├── scripts/
│   └── network-info.js # Informacje o sieci
├── package.json        # Zależności npm
└── README.md          # Ta dokumentacja
```

## 🌟 Funkcje sieciowe

System został skonfigurowany do pracy w sieci lokalnej:
- Automatyczne wykrywanie adresów IP
- Bezpieczne sesje dla wielu urządzeń
- CORS skonfigurowany dla sieci lokalnych
- Wyświetlanie dostępnych adresów URL przy starcie

## 🔒 Bezpieczeństwo

- Hashowanie haseł bcrypt
- Sesje z zabezpieczeniami
- Logi audytu wszystkich operacji
- Ograniczenia zapytań (rate limiting)

## 📱 Responsywność

Interface został zaprojektowany jako responsywny i działa na:
- Komputerach stacjonarnych
- Tabletach
- Telefonach komórkowych

## 🐛 Rozwiązywanie problemów

### Problemy z połączeniem
```bash
# Sprawdź dostępne adresy IP
npm run info

# Uruchom w trybie sieciowym
npm run network
```

### Resetowanie bazy danych
Usuń plik `ip_management.db` - zostanie utworzony ponownie przy następnym uruchomieniu.

## 📄 Licencja

MIT License - szczegóły w pliku LICENSE.

## 🤝 Wsparcie

W przypadku problemów lub pytań, skontaktuj się z administratorem systemu.