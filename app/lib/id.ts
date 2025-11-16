const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createThingId(length = 12) {
  let id = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHANUM.length);
    id += ALPHANUM[index];
  }
  return id;
}
