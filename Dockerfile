FROM node:22-alpine

RUN npm install -g opencode-ai && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

RUN mkdir -p /home/appuser/.local/share/opencode \
             /home/appuser/.config/opencode/agents

RUN chown -R appuser:appgroup /home/appuser/.local /home/appuser/.config

COPY .opencode/agents/autoaccept.json /home/appuser/.config/opencode/agents/autoaccept.json

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

CMD ["/bin/sh", "-c", "mkdir -p /home/appuser/.local/share/opencode && echo \"{\\\"opencode\\\": {\\\"type\\\": \\\"api\\\", \\\"key\\\": \\\"$OPENCODE_API_KEY\\\"}}\" > /home/appuser/.local/share/opencode/auth.json && chmod 600 /home/appuser/.local/share/opencode/auth.json && node src/index.js"]
