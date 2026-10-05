FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CMS_DB_FILE=/data/cms.sqlite \
    CMS_UPLOAD_DIR=/data/uploads

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force \
    && mkdir -p /data/uploads \
    && chown -R node:node /data

COPY --chown=node:node . .

USER node
VOLUME ["/data"]
EXPOSE 3000

CMD ["npm", "start"]
