# Contributing to PS Analyzer

Thank you for your interest in contributing to PS Analyzer! We welcome contributions from the community to help make this Sanger sequencing analysis tool even better for clinical and research use.

Please review the guidelines below to get started.

## 1. Setting Up the Development Environment

Before you begin, make sure you have the following prerequisites installed on your system:

* **Node.js** (v20+)
* **Rust** (for Tauri desktop builds)
* **Conda/Python** (for the sibling `bio-engine` backend)
* **Angular CLI** (install globally via `npm install -g @angular/cli`)

### Installation & Run Steps

Follow the detailed installation steps outlined in the [README.md](./README.md):

1. Clone this repository (`ms-analyzer`) and the backend repository (`bio-engine`) as sibling directories.
2. In the `ms-analyzer` directory, install Node dependencies:
   ```bash
   npm install
   ```
3. To run the application in development mode with both the Tauri shell and bio-engine backend sidecar, run:
   ```bash
   ./debug/build_run.sh
   ```

---

## 2. Code Quality and Linting

To maintain a consistent and clean codebase, we enforce linting. Please make sure your code passes linting before submitting a pull request.

* **Run Linting**:
  ```bash
  npm run lint
  ```
* **Auto-Fix Issues**:
  ```bash
  npm run lint -- --fix
  ```

---

## 3. Running Tests

### Frontend & App Tests
Currently, the Angular frontend tests are being structured. 

### Backend Rust Core
To run the Tauri backend tests (written in Rust), run:
```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 4. How to Open a Pull Request

We follow a typical Git branch-and-merge workflow:

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally.
3. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/my-new-feature
   ```
4. **Make changes** and ensure they adhere to our coding style.
5. **Lint and test** your changes to ensure no regressions are introduced.
6. **Commit** your changes with clear and descriptive commit messages (following Conventional Commits: e.g., `feat: ...`, `fix: ...`).
7. **Push** to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
8. Open a **Pull Request** (PR) against the main branch of `ps-analyzer`. Explain the purpose of your changes and reference any related issues.

---

## Code of Conduct

We expect all contributors to adhere to the Contributor Covenant Code of Conduct. Please read the [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct.md) to understand the behavior expected in our community.
