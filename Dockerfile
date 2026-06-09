FROM node:22-alpine

RUN npm install -g opencode-ai && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup

RUN mkdir -p /home/appuser/.local/share/opencode \
             /home/appuser/.config/opencode/agents

COPY opencode-auth/auth.json /home/appuser/.local/share/opencode/auth.json

RUN chown -R appuser:appgroup /home/appuser/.local /home/appuser/.config && \
    chmod 600 /home/appuser/.local/share/opencode/auth.json

# copy autoaccept agent to global config path where opencode will find it
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

CMD ["node", "src/index.js"]
