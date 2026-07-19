FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages slither-analyzer solc-select
RUN solc-select install 0.8.19 && solc-select use 0.8.19

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
