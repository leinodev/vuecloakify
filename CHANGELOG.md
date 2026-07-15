# Changelog

All notable changes to this project will be documented in this file. The
project follows [Semantic Versioning](https://semver.org/).

## 0.1.0 - Unreleased

### Added

- Type-safe Vue helpers for Keycloak FreeMarker context values.
- Vue/Vite compilation for login themes and optional MJML email compilation.
- CLI, configuration-file, and programmatic build APIs.
- Production and debug builds with safe output-directory validation.
- Runnable basic and custom-entry examples.
- Standalone package metadata, CI, release guidance, and npm provenance setup.
- TypeScript 6 toolchain with Vue language tooling compatible with TS 6.

### Changed

- Renamed the project and CLI to `@leinodev/vuecloakify` and `vuecloakify`.
- Removed the mandatory Unhead integration from consumer projects; custom
  entries now only need to export their Vue `app`.
