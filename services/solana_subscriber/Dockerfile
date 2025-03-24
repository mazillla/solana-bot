# Используем Node.js 18
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./

RUN npm install

# Копируем код микросервиса
COPY . .


# Открываем порты (если потребуется)
EXPOSE 3000

# Запускаем микросервис
CMD ["node", "index.js"]
