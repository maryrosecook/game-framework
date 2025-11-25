import { loadGameResponse, saveGameResponse } from "../handlers";

type RouteContext = {
  params: Promise<{ game: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  return loadGameResponse(params.game);
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const payload = (await request.json()) as unknown;
  const game =
    payload && typeof payload === "object" && "game" in payload
      ? (payload as { game: unknown }).game
      : null;
  return saveGameResponse(params.game, game);
}
