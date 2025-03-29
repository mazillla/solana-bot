FROM node:20

WORKDIR /app

# Копируем весь проект
COPY ../../ ./

# Переходим в директорию сервиса
WORKDIR /app/services/config_watcher

RUN npm install

CMD ["node", "index.js"]
