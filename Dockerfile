FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY docs ./docs

RUN mkdir -p /app/data

ENV DOCKER=true
ENV PORT=3000
EXPOSE 80 3000

CMD ["node", "server.js"]
