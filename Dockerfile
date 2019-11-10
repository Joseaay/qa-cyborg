FROM node:alpine as builder

WORKDIR /app/probot/

RUN apk add --no-cache --virtual .gyp python make g++

COPY ./package*.json ./

RUN npm install


FROM node:alpine as app

WORKDIR /app/probot/

COPY --from=builder /app/probot/node_modules/ ./node_modules/
COPY . ./

RUN npm run build

EXPOSE 3000

COPY .env ./

ENTRYPOINT [ "npm", "start" ]
