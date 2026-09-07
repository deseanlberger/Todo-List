/**
 * Read an environment variable, treating blank as unset.
 *
 * `process.env.X ?? default` looks right and is wrong here: hosts like Vercel
 * happily create a variable with an empty value when you scaffold from an
 * `.env.example` and skip a field. `""` is not nullish, so the default never
 * fires and the app runs on an empty string — an empty APP_USER_ID matches no
 * rows, an empty time zone throws inside Intl.
 */
export function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== "" ? value : fallback;
}

/** True only when the variable is set to something non-blank. */
export function hasEnv(name: string): boolean {
  const value = process.env[name];
  return value !== undefined && value.trim() !== "";
}
