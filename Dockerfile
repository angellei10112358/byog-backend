FROM node:22-alpine

RUN npm install -g opencode-ai && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

RUN mkdir -p /home/appuser/.local/share/opencode

COPY opencode-auth/auth.json /home/appuser/.local/share/opencode/auth.json

RUN chown -R appuser:appgroup /home/appuser/.local/share/opencode && \
    chmod 600 /home/appuser/.local/share/opencode/auth.json

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV OPENCODE_MODEL=opencode/deepseek-v4-flash-free
ENV WORKSPACES_ROOT=/app/workspaces
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/index.js"]
