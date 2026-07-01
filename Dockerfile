FROM oven/bun:1.3.14 AS build
WORKDIR /home/node/app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run typecheck

FROM oven/bun:1.3.14
WORKDIR /home/node/app

COPY --from=build /home/node/app/package.json .
COPY --from=build /home/node/app/bun.lock .

RUN bun install --frozen-lockfile --production --ignore-scripts

COPY --from=build /home/node/app/src ./src
COPY --from=build /home/node/app/configs_example ./configs_example
COPY --from=build /home/node/app/tsconfig.json .

CMD [ "bun", "src/index.ts"]
