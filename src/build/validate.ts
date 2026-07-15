/**
 * Template names Keycloak looks up in a theme. A differently named page, such
 * as `loginOtp` instead of `login-otp`, is not picked up automatically. Unknown
 * names produce a warning rather than an error because partials are allowed.
 */
const KNOWN_LOGIN_TEMPLATES = new Set([
  "login",
  "login-username",
  "login-password",
  "login-otp",
  "login-reset-otp",
  "register",
  "register-user-profile",
  "login-reset-password",
  "login-update-password",
  "login-update-profile",
  "login-config-totp",
  "login-verify-email",
  "login-page-expired",
  "login-idp-link-confirm",
  "login-idp-link-email",
  "login-x509-info",
  "webauthn-register",
  "webauthn-authenticate",
  "webauthn-error",
  "login-recovery-authn-code-config",
  "login-recovery-authn-code-input",
  "login-passkeys-conditional-authenticate",
  "select-authenticator",
  "login-oauth-grant",
  "login-oauth2-device-verify-user-code",
  "logout-confirm",
  "frontchannel-logout",
  "delete-account-confirm",
  "delete-credential",
  "update-user-profile",
  "idp-review-user-profile",
  "saml-post-form",
  "code",
  "error",
  "info",
  "terms",
  "cli_splash",
]);

const KNOWN_EMAIL_TEMPLATES = new Set([
  "email-verification",
  "email-test",
  "email-update-confirmation",
  "executeActions",
  "identity-provider-link",
  "password-reset",
  "event-login_error",
  "org-invite",
]);

/** Warns about page names Keycloak does not recognize as standard theme templates. */
export function warnUnknownTemplates(names: string[], kind: "login" | "email"): void {
  const known = kind === "login" ? KNOWN_LOGIN_TEMPLATES : KNOWN_EMAIL_TEMPLATES;
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length === 0) return;
  console.warn(
    `[vuecloakify] ${kind}: non-standard Keycloak template name(s). `
    + `Keycloak will ignore them unless they are partials: ${unknown.join(", ")}`,
  );
}
