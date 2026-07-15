# Contributing

Thanks for helping improve Vuecloakify.

## Development

Requirements: Node.js 20.19+ (or 22.12+) and pnpm 10+.

```bash
pnpm install
pnpm check
```

Useful focused commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm examples:check
```

Tests use Node's built-in test runner. Add regression coverage for behavior
changes, and update the README and examples when the public API changes.

## Pull requests

- Keep changes focused and describe externally visible behavior.
- Do not commit `dist/`, `node_modules/`, generated example themes, or package
  archives.
- Treat the runtime and `@leinodev/vuecloakify/build` exports as public API.
- Use Conventional Commit-style subjects when practical, for example
  `fix: preserve imported CSS for shared chunks`.
