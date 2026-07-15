/**
 * Rewrites asset paths (`/resources/...`, `/assets/...`) into paths that
 * Keycloak can serve. SSR/FTL mode (without `window`) uses the FreeMarker
 * expression `${url.resourcesPath}`; the browser uses the resolved value from
 * `window.ENVIRONMENT.resourcesPath`; development uses a page-relative path.
 */
function getWindow(): (Window & { ENVIRONMENT?: { resourcesPath?: string } }) | undefined {
  try {
    return window as unknown as Window & { ENVIRONMENT?: { resourcesPath?: string } };
  } catch {
    return undefined;
  }
}

export function fixResourcesPath(debug: boolean, path: string, basePath: string): string {
  const w = getWindow();
  const resourcesPath = w === undefined ? "${url.resourcesPath}" : w.ENVIRONMENT?.resourcesPath;
  const prefix = debug ? `/${basePath}/resources/` : `${resourcesPath}/`;

  if (path.startsWith("/resources/")) path = path.replace("/resources/", () => prefix);
  if (path.startsWith("resources/")) path = path.replace("resources/", () => prefix);
  if (path.startsWith("/assets/")) path = path.replace("/assets/", () => prefix);

  return path;
}
