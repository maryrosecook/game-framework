export function shouldIncludeEditKeyInHomeURL(): boolean {
  return process.env.NODE_ENV === "development";
}
