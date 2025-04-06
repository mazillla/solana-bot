FROM node:20

WORKDIR /app

COPY . .

RUN npm install --prefix services/config_server

CMD ["node", "services/config_server/index.js"]
