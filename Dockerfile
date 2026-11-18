FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=7000 \
    TZ=Europe/Budapest

RUN apk add --no-cache tzdata

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node scripts/verify.js ./scripts/verify.js

LABEL org.opencontainers.image.title="Magyar Streaming Pro (Nuvio & Stremio Addon)" \
      org.opencontainers.image.description="Magyar HTTP Streaming Addon Nuvio & Stremio kliensekhez (magyar filmek, sorozatok, feliratok & Elo TV EPG)" \
      org.opencontainers.image.source="https://github.com/Player798xy/nuvio-magyar-http" \
      org.opencontainers.image.licenses="MIT"

USER node

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 7000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
