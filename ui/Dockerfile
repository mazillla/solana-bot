FROM node:20

WORKDIR /app

COPY . .

CMD ["sh", "-c", "chmod +x ./node_modules/.bin/serve && npx serve -s build -l 3000"]
