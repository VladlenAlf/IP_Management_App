# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем остальные файлы приложения
COPY . .

# Создаем директории для uploads и базы данных
RUN mkdir -p uploads data && \
    chown -R node:node /app

# Переключаемся на пользователя node для безопасности
USER node

# Устанавливаем переменную для базы данных
ENV DB_PATH=/app/data/ip_management.db

# Открываем порт 3000
EXPOSE 3000

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Запускаем приложение
CMD ["npm", "start"]
