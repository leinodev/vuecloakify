# Releasing

Releases are published as the public npm package `@leinodev/vuecloakify` from
the repository root.

## First release prerequisites

1. Create `https://github.com/leinodev/vuecloakify` from the contents of this
   directory (this directory becomes the repository root).
2. Confirm that the `@leinodev` npm scope exists and that the publishing account
   can publish public scoped packages.
3. Protect the default branch and require the `CI` workflow.
4. Configure npm trusted publishing for the GitHub repository if releases will
   use provenance without a long-lived npm token.

## Release checklist

1. Update `CHANGELOG.md` and choose the SemVer version:

   ```bash
   pnpm version patch --no-git-tag-version
   ```

2. Install exactly what is recorded in the lockfile and run the full suite:

   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   ```

3. Inspect the public archive:

   ```bash
   mkdir -p .release
   pnpm pack --pack-destination .release
   tar -tf .release/leinodev-vuecloakify-*.tgz
   tar -xOf .release/leinodev-vuecloakify-*.tgz package/package.json
   ```

   The archive must contain `dist/`, `README.md`, and `LICENSE`, and must not
   contain source tests, examples, workspace protocols, or development files.
   `package/bin/vuecloakify.js` must be executable.

4. Commit the version and changelog, create an annotated `vX.Y.Z` tag, and push
   both.
5. Publish from a clean checkout:

   ```bash
   pnpm publish --access public --provenance
   ```

6. In the SpaceMC monorepo, replace the temporary local dependency
   `link:../../../vuecloakify` with the published `^X.Y.Z` range before deleting
   the extracted directory.

The `prepack` lifecycle repeats linting, type checking, unit/integration tests,
example builds, and package metadata validation. Do not bypass it for a public
release.
