import { loadGameResponse, saveGameResponse } from "../handlers";
import { extractEditKeyFromUrl } from "@/lib/editKey";
import { isRecord } from "@/engine/types";

type RouteContext = {
  params: Promise<{ game: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const editKey = extractEditKeyFromUrl(_request);
  return loadGameResponse(params.game, editKey);
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const payload = await request.json().catch(() => null);
  const game = isRecord(payload) ? payload.game : null;
  const editKey = extractEditKeyFromUrl(request);
  return saveGameResponse(params.game, game, editKey);
}
