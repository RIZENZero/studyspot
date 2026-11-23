FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

EXPOSE 4000
ENV PORT=4000
ENV HOST=0.0.0.0

CMD ["npm", "start"]
