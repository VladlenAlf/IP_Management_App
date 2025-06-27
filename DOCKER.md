# Docker Setup для System Zarządzania Adresami IP

## 🐳 Быстрый старт с Docker

### Вариант 1: Docker Compose (рекомендуется)

1. **Запуск приложения:**
```bash
docker compose up -d
```

2. **Просмотр логов:**
```bash
docker compose logs -f
```

3. **Остановка:**
```bash
docker compose down
```

4. **Проверка статуса:**
```bash
docker compose ps
```

### Вариант 2: Docker без Compose

1. **Сборка образа:**
```bash
docker build -t ip-management-system .
```

2. **Запуск контейнера:**
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

## 📋 Настройка переменных окружения

Скопируйте `.env.docker` в `.env` и настройте под ваши нужды:

```bash
cp .env.docker .env
```

Основные переменные:
- `ADMIN_USERNAME` - логин администратора
- `ADMIN_PASSWORD` - пароль администратора  
- `SESSION_SECRET` - секретный ключ для сессий (обязательно измените!)
- `NODE_ENV` - окружение (production/development)

## 🗂️ Структура томов

- `./data:/app/data` - база данных SQLite
- `./uploads:/app/uploads` - загруженные файлы
- `./backups:/backup/output` - резервные копии (опционально)

## 🔧 Полезные команды NPM

```bash
# Docker Compose
npm run docker:compose:up     # Запуск с compose
npm run docker:compose:down   # Остановка compose
npm run docker:compose:logs   # Просмотр логов
npm run docker:compose:build  # Пересборка образов
npm run docker:compose:ps     # Статус контейнеров
npm run docker:compose:restart # Перезапуск контейнеров

# Обычный Docker
npm run docker:build          # Сборка образа
npm run docker:run           # Запуск контейнера
npm run docker:stop          # Остановка контейнера
npm run docker:remove        # Удаление контейнера
```

## 🌐 Доступ к приложению

После запуска приложение будет доступно по адресу:
- http://localhost:3000
- http://your-server-ip:3000

**Данные для входа:**
- Логин: admin (или значение из ADMIN_USERNAME)
- Пароль: admin123 (или значение из ADMIN_PASSWORD)

## 🔒 Безопасность

1. **Обязательно измените пароли по умолчанию!**
2. Используйте сильный `SESSION_SECRET`
3. При развертывании в продакшене настройте firewall
4. Рассмотрите использование reverse proxy (nginx) с SSL

## 📦 Резервное копирование

Docker Compose включает автоматический сервис резервного копирования:
- Создает бэкапы каждые 24 часа
- Сохраняет в папку `./backups/`
- Автоматически удаляет старые бэкапы (>30 дней)

Ручное создание бэкапа:
```bash
docker exec ip-management-backup tar -czf /backup/output/manual-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /backup data
```

## 🔧 Устранение неполадок

### Проверка статуса контейнеров:
```bash
docker compose ps
# или
sudo docker ps -a
```

### Просмотр логов:
```bash
docker compose logs ip-management
# или для всех сервисов
docker compose logs -f
```

### Подключение к контейнеру:
```bash
docker exec -it ip-management-system sh
```

### Проверка томов:
```bash
docker volume ls
```

## 📊 Мониторинг

Для продакшен-среды рекомендуется добавить мониторинг:
- Health checks
- Log aggregation
- Performance monitoring
- Alerts

Пример health check можно добавить в Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth-status || exit 1
```
