# PS Analyzer

PS Analyzer is a modern Sanger sequence analysis tool designed for clinical and research use. It provides a comprehensive suite of features for variant detection, visualization, and report generation, built with performance and security in mind using Angular and Tauri.

## Features

- **High-Performance Visualization**: Smooth, zoomed, and interactive Sanger trace dashboards.
- **Automated Variant Detection**: Integration with `bio-engine` for precise SNV and Indel identification.
- **VEP Integration**: Automatic annotation of variants using the Ensembl Variant Effect Predictor.
- **Clinical Reporting**: Professional PDF and HTML report generation with customizable variant and read selection.
- **Secure by Design**: Local-first architecture powered by Tauri, ensuring sensitive genetic data stays on your machine.
- **Modern Tech Stack**: Built with Angular 20, utilizing Signals and modern control flow for a reactive and efficient UI.

## Repository Setup

This repository contains the frontend and desktop application logic. It expects a sibling directory `bio-engine` containing the backend analysis services.

### Prerequisites

- **Node.js**: v20+
- **Rust**: For Tauri builds
- **Conda/Python**: For the `bio-engine` backend (if building from source)
- **Angular CLI**: `npm install -g @angular/cli`

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/pabloferlagosidipaz/ps-analyzer.git
    cd ps-analyzer
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Ensure `bio-engine` is present in the sibling directory. You can clone it and build it, or download the latest release:
    ```bash
    cd ..
    git clone https://github.com/pabloferlagosidipaz/bio-engine.git
    cd bio-engine
    # Follow bio-engine README for environment setup and build
    cd ../ps-analyzer
    ```

### Running the Application

To run the application in development mode:

```bash
./debug/build_run.sh
```

This script will:
1.  Activate the necessary Conda environment.
2.  Build the `bio-engine` sidecar.
3.  Start the Tauri development server and Angular frontend.

### Linting

To run the linter and check for code quality issues:

```bash
npm run lint
```

To automatically fix common linting issues:

```bash
npm run lint -- --fix
```

## Configuration

The application communicates with a local FastAPI server (part of the bio-engine). The API URL is configurable in `src/app/core/services/analysis.service.ts` or via environment variables in future releases.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for feature requests and bug reports.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
