FROM debian AS build
WORKDIR /home/node/app

COPY . .
 
RUN apt-get update -y
RUN curl -sL https://deb.nodesource.com/setup_17.x  | bash -
RUN apt-get -y install nodejs
RUN npm i -g yarn

RUN yarn
RUN yarn build

FROM debian
WORKDIR /home/node/app

RUN apt-get update -y
RUN curl -sL https://deb.nodesource.com/setup_17.x  | bash -
RUN apt-get -y install nodejs
RUN npm i -g yarn

COPY --from=build /home/node/app/package.json .
COPY --from=build /home/node/app/yarn.lock .

RUN yarn

COPY --from=build /home/node/app/build .

CMD [ "node", "index.js"]