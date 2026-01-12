import { loadGameResponse, saveGameResponse } from "../handlers";
import { extractEditKeyFromRequest } from "@/lib/editKey";
import { isRecord } from "@/engine/types";

type RouteContext = {
  params: Promise<{ game: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const editKey = extractEditKeyFromRequest(_request);
  return loadGameResponse(_request, params.game, editKey);
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const payload = await request.json().catch(() => null);
  const game = isRecord(payload) ? payload.game : null;
  const editKey = extractEditKeyFromRequest(request);
  return saveGameResponse(request, params.game, game, editKey);
}
