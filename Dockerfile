# Development environment for MS-Analyzer (Tauri + Angular)
FROM rust:1.77-bullseye

# Install Tauri system dependencies
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the dev server port (default for Tauri/Vite/Angular setup in this project)
EXPOSE 1420

# Command to run the development environment
# NOTE: Running 'tauri dev' inside Docker requires an X11 server or a virtual frame buffer.
# For remote work, users typically use this with VS Code Dev Containers.
CMD ["npm", "run", "tauri", "dev"]
