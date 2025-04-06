FROM node:20

WORKDIR /app

COPY . .

RUN npm install --prefix services/config_watcher

CMD ["node", "services/config_watcher/index.js"]
