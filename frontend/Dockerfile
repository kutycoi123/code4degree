FROM node:12.16

WORKDIR /app

ENV REACT_APP_BASE_URL="http://35.203.116.199/"

COPY package*.json ./
RUN npm install --silent

ADD . /app
EXPOSE 8080 


CMD npm start
