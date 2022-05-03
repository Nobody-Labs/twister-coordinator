FROM node:12-alpine3.14
ENV NODE_ENV production
WORKDIR /app
COPY . ./
RUN yarn
RUN npx tsc
EXPOSE 8080
ENTRYPOINT ["yarn"]