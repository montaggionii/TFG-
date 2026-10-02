# Agent Layer de FidelyFood para una VPS / contenedor. NO VERIFICADO: este Dockerfile no se ha construido
# todavia (requiere descargar imagenes base); ver AGENT_LAYER.md ("Despliegue en VPS").
#
#   docker build -t fidelyfood-agent agent
#   docker run --rm -it \
#     -v "$PWD":/workspace                      # el repositorio (copia de trabajo, rama agent/*)
#     -v fidelyfood-agent-data:/var/lib/fidelyfood-agent \
#     -e AGENT_ENV=staging -e AGENT_PROVIDER=anthropic -e ANTHROPIC_API_KEY \
#     fidelyfood-agent --task AGT-001
#
# Aprobaciones humanas: la clave de firma vive en un volumen aparte que solo monta quien aprueba
# (docker exec -it <contenedor> npm run approve -- list).
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git openjdk-17-jdk-headless default-mysql-client gh ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/fidelyfood-agent
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY config ./config
COPY src ./src

# Usuario sin privilegios: el agente no debe ser root.
RUN useradd --create-home --uid 10001 agent && mkdir -p /var/lib/fidelyfood-agent /workspace && chown agent /var/lib/fidelyfood-agent
USER agent

ENV AGENT_REPO_ROOT=/workspace \
    AGENT_DATA_DIR=/var/lib/fidelyfood-agent \
    AGENT_JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    AGENT_ENV=staging

ENTRYPOINT ["node", "src/runner/run.mjs"]
