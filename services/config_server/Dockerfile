FROM node:20

# Рабочая директория в контейнере
WORKDIR /app

# Копируем только package.json и lock
COPY ./services/config_server/package*.json ./services/config_server/

# Устанавливаем зависимости
WORKDIR /app/services/config_server
RUN npm install

# Копируем исходники сервиса
COPY ./services/config_server ./services/config_server

# Команда запуска
CMD ["node", "index.js"]
