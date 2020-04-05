FROM node:12.16

WORKDIR /app

ENV MONGODB_CONNECT_URL="mongodb+srv://cmpt470:code4degree@cmpt470-zfnmr.mongodb.net/code4degree?retryWrites=true&w=majority"
ENV PORT=8080
ENV JWT_PRIVATE_KEY="NOTEVERYSECRETSECRET"

COPY package*.json ./
RUN npm install

ADD . /app
EXPOSE 8080


CMD npm start
