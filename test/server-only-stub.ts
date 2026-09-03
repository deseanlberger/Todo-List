// `server-only` throws when resolved outside a React Server Component build.
// Under Vitest there is no such build, so it is aliased to this no-op — the
// guard exists to protect the browser bundle, not the test runner.
export {};
