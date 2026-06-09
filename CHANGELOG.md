# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-06-09
### Added
- Support OpenCRAVAT module installation and system version in settings

### Changed
- Persist Redis cache data across container restarts
- Move app version info to global configuration sidebar and replace annotation mode select with a switch
- Hide default base modules from local annotator listings
- Rename OpenCRAVAT references to generic Local Annotator

### Fixed
- Constrain variant list tooltip layout and add consequence full name

## [v0.1.48] - 2026-05-28
### Added
- Improve hotspots table and search view, bump version to 0.1.48

## [v0.1.47] - 2026-05-27
## [v0.1.46] - 2026-05-26
### Added
- Variant highlight
- Heterozygotus diferrence on decolapse
- Retrieval by assembly
- General warning
- Add sanger sequence alert
- Double cursor on heterozygotus
- Status pill
- Hotspost variants v1
- Export to FHIR
- Prompt set name
- Always on visualization
- Reduce space on top
- Synced nucleotide movement
- Redis on system
- Prioritize
- Prioritiza NM
- Move with arrouws
- Barra para mas espacio en cronomatograma
- Reference sequence controls
- Status filter
- Reviews flags
- Browser dialogs
- Add support for Docker server/intranet deployment

### Changed
- Docker images changes
- Restore: rows

### Fixed
- Fihr convention
- Sanger cursors
- Disappeared row
- Web version

## [v0.1.45] - 2026-04-22
### Added
- Complete portable structure with redundant sidecars in root and binaries

## [v0.1.44] - 2026-04-22
### Added
- Detect portable mode and pass --data-dir to sidecar

## [v0.1.43] - 2026-04-20
### Added
- Add portable windows build to workflow and sync versions

## [v0.1.42] - 2026-04-13
### Added
- New fullscreen button sanger

### Changed
- Update

### Fixed
- Order on result

## [v0.1.41] - 2026-04-07
### Changed
- Bump version to 0.1.41 and improve sidecar path detection
- Standardize bio-engine sidecar asset download names

## [v0.1.40] - 2026-04-06
### Changed
- Bump version to 0.1.40 for release
- Automate Windows DLL bundling for sidecars using ldd

### Fixed
- Pin Tauri plugin versions to resolve CI mismatch
- Remove linux samtools sidecar and fix windows samtools inclusion
- Add samtools to windows sidecars in build workflow
- Register bgzip sidecar and handle DLL resource path

## [v0.1.39] - 2026-03-26
### Changed
- Remove minimal build and optimize main Linux release

## [v0.1.38] - 2026-03-26
### Changed
- Bump version to 0.1.38 and optimize Linux build

## [v0.1.37] - 2026-03-25
### Changed
- Bump version to 0.1.37 and fix sidecar resource configuration

## [v0.1.36] - 2026-03-25
## [v0.1.35] - 2026-03-25
### Fixed
- Fix yaml syntax and correctly order windows steps v0.1.35

## [v0.1.34] - 2026-03-25
### Fixed
- Use powershell for dummy files on windows and bump version to 0.1.34

## [v0.1.33] - 2026-03-25
### Fixed
- Use dummy.txt for resource stability and fix windows build v0.1.33

## [v0.1.32] - 2026-03-25
### Fixed
- Resolve corruption in build.yml and bump version
- Final touch for resource glob

## [v0.1.31] - 2026-03-25
### Fixed
- Final fix for resource glob and version bump

## [v0.1.30] - 2026-03-25
### Fixed
- Resolve build failure due to missing resource glob matches

## [v0.1.29] - 2026-03-25
### Fixed
- Resolve DLL missing and permission denied issues

## [v0.1.28] - 2026-03-25
## [v0.1.27] - 2026-03-25
### Fixed
- Add sidecar path resolution logging

## [v0.1.26] - 2026-03-25
### Fixed
- Resolve sidecar paths with .exe extension

## [v0.1.25] - 2026-03-25
### Changed
- Remove samtools from sidecar resolution
- Fix minimal build by removing bgzip from sidecars
- Remove samtools from build workflow and documentation
- Remove samtools from build workflow

## [v0.1.24] - 2026-03-24
### Fixed
- Improve sidecar discovery and sync version to 0.1.23

## [v0.1.23] - 2026-03-24
### Fixed
- Resolve windows bgzip access violation by bundling essential MSYS2 DLLs and avoiding shell redirection in bio-engine, bump to v0.1.23

## [v0.1.22] - 2026-03-24
### Added
- Implement dual-build strategy for Linux (Bundled vs Minimal) and bump to v0.1.22

## [v0.1.21] - 2026-03-24
### Fixed
- Rename sidecars with ps-analyzer- prefix to avoid linux system conflicts and bump to v0.1.21

## [v0.1.20] - 2026-03-24
### Fixed
- Use msys2 shell for windows sidecar binaries and bump to v0.1.20

## [v0.1.19] - 2026-03-24
## [v0.1.18] - 2026-03-23
### Added
- Contain tracy, samtools and bgzip
- VEP config
- Local icons

### Changed
- Dockerfile

## [v0.1.17] - 2026-03-09
### Added
- Marker on report

### Changed
- Release v0.1.17 - variant markers in report
- Logo update

### Fixed
- Hidden signal pop up

## [v0.1.16] - 2026-02-26
### Added
- Reorder variant list elements
- Fix report overflow
- Variant list counts
- Proxy
- Sarch by gene
- Move new project button

## [v0.1.15] - 2026-02-25
## [v0.1.14] - 2026-02-25
### Changed
- Fetch latest tracy windows binary dynamically from upstream
- Update Acknowledgments

### Fixed
- Resolve unused Mutex import and deprecated APP_INITIALIZER (v0.1.13)

## [v0.1.12] - 2026-02-25
### Fixed
- Remove npm cache as lockfile is not tracked, bump version to v0.1.12

## [v0.1.11] - 2026-02-25
### Added
- Remove dialog and change for scroll

### Changed
- Enable npm and rust caching, bump version to v0.1.11, update app identifier
- Update repository ownership to lagosproject

## [v0.1.10] - 2026-02-24
### Fixed
- Bump version to v0.1.10 following bio-engine v0.5.0 build completion

## [v0.1.9] - 2026-02-24
### Fixed
- Strictly compile on ubuntu-22.04 for maximal linux application compatibility, bump to v0.1.9

## [v0.1.8] - 2026-02-24
### Fixed
- Remove ubuntu-22.04 matrix and restore default tauri action release bundling, bump to v0.1.8

## [v0.1.7] - 2026-02-24
### Fixed
- Bump version to v0.1.7 immediately to force download of fully published bio-engine v0.4.9 binaries

## [v0.1.6] - 2026-02-24
### Fixed
- Bump version to v0.1.6 to download bio-engine v0.4.9 with httpx bundled

## [v0.1.5] - 2026-02-24
### Fixed
- Change ubuntu-24.04 to ubuntu-latest in build matrices and bump version to v0.1.5

## [v0.1.3] - 2026-02-24
### Added
- Add ubuntu-24.04 and ubuntu-22.04 cross-compilation matrix and bump version to 0.1.3

## [v0.1.1] - 2026-02-24
### Fixed
- Downgrade ubuntu-latest to ubuntu-22.04 for GLIBC compat and bump version to 0.1.1

## [v0.1.0] - 2026-02-24
### Added
- Add logo to README

### Changed
- Update Cargo.lock for Tauri v2.10.0 alignment
- Remove local engine symlink and ignore it
- Refine GitHub Actions: trigger only on release
- Initial commit

### Fixed
- Adjust Tauri action tag name and release configuration
- Add gettext dependency and libintl linker flags for Windows
- Correct MSYS2 package names for libtre
- Add ltre dependency and correct linker flag order for Windows
- Append winsock and regex libs to end of tracy linker flags
- Add -lws2_32 and -lregex to Tracy linker flags on Windows
- Suppress SDSL use-after-free warnings and fix Boost linker paths
- Add libdeflate and use native g++ to fix Windows linker errors
- Patch tracy Makefile with Winsock compatibility flags for Windows
- Add .sdsl sentinel to prevent Tracy Makefile from re-running install.sh
- Use find to locate sdsl/divsufsort libs in cmake build output
- Manually install sdsl headers/libs, skip googletest entirely
- Build all sdsl targets with make -j instead of explicit target names
- Bypass sdsl-lite install.sh, build cmake manually to skip googletest
- Disable sdsl-lite test build to avoid GCC 15 incompatible googletest
- Force Unix Makefiles generator for sdsl-lite cmake build on Windows
- Recursively patch all CMakeLists.txt in sdsl-lite for modern CMake
- Correct sed regex for sdsl-lite CMakeLists.txt patch
- Patch sdsl-lite CMakeLists.txt for modern CMake compatibility on Windows
- Add cmake to Windows MSYS2 environment for tracy sdsl-lite build
- Use ^2.10.0 for @tauri-apps/api to pick up 2.10.1 with correct module exports
- Regenerate Cargo.lock to resolve tauri v2.10.x version mismatch
- Add missing build tools to Windows CI environment
- Fix Tauri version mismatch: align to v2.10.0
- Fix Tauri version mismatch: pin to v2.10.1
