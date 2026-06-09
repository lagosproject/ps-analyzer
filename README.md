<p align="center">
  <img src="src/assets/logo.svg" alt="PS Analyzer Logo" width="200">
</p>

# PS Analyzer

PS Analyzer is a modern Sanger sequence analysis tool designed for clinical and research use. It provides a comprehensive suite of features for variant detection, visualization, and report generation, built with performance and security in mind using Angular and Tauri.

## Features at a Glance

PS Analyzer guides you through a seamless, automated end-to-end clinical workflow:
1. **Upload Trace (.ab1)**: Import your Sanger chromatogram file directly.
2. **Align to Reference**: Automatically align the trace to a reference FASTA template sequence.
3. **Detect Variants**: Call single nucleotide variants (SNVs) and insertions/deletions (indels) with high-confidence quality filtering.
4. **Generate Report**: Review findings and export a clinical-grade PDF or HTML report with fully annotated variants.

## Features

- **High-Performance Visualization**: Smooth, zoomed, and interactive Sanger trace dashboards.
- **Automated Variant Detection**: Integration with `bio-engine` for precise SNV and Indel identification.
- **VEP Integration**: Automatic annotation of variants using the Ensembl Variant Effect Predictor.
- **Clinical Reporting**: Professional PDF and HTML report generation with customizable variant and read selection.
- **Self-Contained**: `tracy` and `bgzip` are bundled with the application. FASTA indexing is handled internally by the `bio-engine` via `pysam`, eliminating the need for an external `samtools` binary.
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

- Download the `PS.Analyzer_X.Y.Z_amd64.deb` package.
- Install using: `sudo apt install ./PS.Analyzer_X.Y.Z_amd64.deb`

This version includes all necessary bioinformatics tools (`bgzip`, `tracy`) bundled as sidecars. FASTA indexing is handled internally by the bundled `bio-engine`. No additional system installation is required.

### Ensuring bio-engine is present
The application expects a sibling directory `bio-engine` containing the backend analysis services if you are running from source. For packaged releases, the `bio-engine` is bundled automatically.

### Running the Application

To run the application in development mode:

```bash
./debug/build_run.sh
```

This script will:
1.  Activate the necessary Conda environment.
2.  Build the `bio-engine` sidecar.
3.  Start the Tauri development server and Angular frontend.

## Quick Start

Get started quickly using our pre-packaged public sample data:

1. **Prerequisites**: Ensure you have Node.js (v20+), Rust, and Conda installed.
2. **Clone & Setup**:
   ```bash
   git clone https://github.com/lagosproject/ps-analyzer.git
   cd ps-analyzer
   npm install
   ```
3. **Run the App**:
   ```bash
   ./debug/build_run.sh
   ```
4. **Run a Demo Analysis**:
   - Once the application window opens, click **New Project**.
   - For **Sanger Trace file**, choose: `sample-data/sample1_3100.ab1`
   - For **Reference sequence**, choose: `sample-data/sample1_3100.fasta`
   - Click **Run Alignment & Variant Calling**.
   - Inspect the aligned chromatogram trace, verify detected variants, and generate your clinical report!

### Linting

To run the linter and check for code quality issues:

```bash
npm run lint
```

To automatically fix common linting issues:

```bash
npm run lint -- --fix
```

## Docker Deployment (Intranet/Server)

For deployments on local servers or intranets where multiple users need to access the application via a web browser, we provide a server-optimized configuration.

### Deployment via Docker Compose

A `docker-compose.yml` is provided in the project root to orchestrate both the frontend and the bio-engine backend.

1.  **Clone the repositories** (ensure `ms-analyzer` and `bio-engine` are siblings).
2.  **Run with Docker Compose**:
    ```bash
    docker-compose up --build -d
    ```
3.  **Access the application**: The app will be available at `http://<server-ip>:8080`.

### Purpose of Dockerfiles
- **`Dockerfile.server`**: Builds the Angular application and serves it using Nginx. It includes a reverse proxy configuration to route `/api` requests to the backend.
- **`Dockerfile`**: (Standard) Used for development environments and Tauri build pipelines.

## Configuration

The application communicates with a local FastAPI server (part of the bio-engine). The API URL is configurable in `src/app/core/services/analysis.service.ts` or via environment variables in future releases.

## Comparison with Related Tools

PS Analyzer stands out by combining ease of use, local data privacy, and clinical-grade reporting:

| Feature / Capability | **PS Analyzer** | **SnackVar** | **Sequencher** | **TraceTrack** | **sangeranalyseR** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Deployment Model** | Local-First Desktop (Tauri) / Web | Cloud Web App | Local Desktop App | CLI Tool | R Library |
| **Data Privacy** | **Private (Local Processing)** | Public/Third-party Cloud | Private (Local) | Private (Local) | Private (Local) |
| **VEP Integration** | **Yes (Automated)** | No | No | No | No |
| **Clinical PDF Output** | **Yes (Structured)** | No | No | No | No |
| **Cost / License** | **Open Source (MIT)** | Open Source | Commercial (High Cost) | Open Source | Open Source |
| **Target Audience** | Clinicians & Researchers | Researchers | General Biologists | Bioinformaticians | R Developers |

### What Makes PS Analyzer Different?
- **Local-First & Secure**: Unlike web-only tools (e.g., SnackVar), PS Analyzer runs as a local Tauri desktop application. Sensitive patient genomic data never leaves your local machine, ensuring HIPAA and GDPR compliance.
- **Automated VEP Annotation**: Seamlessly integrates with the Ensembl Variant Effect Predictor (VEP) to automatically annotate functional consequences and clinical significance (ClinVar, etc.) of detected variants.
- **Clinical-Grade Reporting**: Generates publication-ready and clinical-diagnostic PDF/HTML reports, complete with quality metrics, mutation markers, and sequence alignments.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for feature requests and bug reports.

## Acknowledgments

This project relies on the following open-source tools and projects:

* [Tracy](https://github.com/gear-genomics/tracy) - Used for trace decomposition and assembly.
* [Ensembl VEP](https://www.ensembl.org/info/docs/tools/vep/index.html) - Used for variant effect prediction.
* [Bio-Engine](https://github.com/lagosproject/bio-engine) - The Python backend for sequence analysis.

## Built With

Here are the major technologies and packages used to build this project:

* [![Angular][Angular.io]][Angular-url]
* [![Tauri][Tauri.app]][Tauri-url]
* [![Rust][Rust-lang.org]][Rust-url]
* [![Python][Python.org]][Python-url]

<!-- Markdown Links & Images for the badges -->
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Angular-url]: https://angular.dev/
[Tauri.app]: https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=white
[Tauri-url]: https://tauri.app/
[Rust-lang.org]: https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white
[Rust-url]: https://www.rust-lang.org/
[Python.org]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
[Python-url]: https://www.python.org/

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
