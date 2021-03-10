FROM node:15
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm ci
CMD node index.js