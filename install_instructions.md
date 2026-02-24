# Install tauri
```bash
npm create tauri-app@latest
```

# Install dependencies
https://rust-lang.org/learn/get-started/#installing-rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```



# Initial install
```bash
npm install
npm run tauri add shell
npm run tauri dev
```