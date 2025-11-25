import { Home } from "@/components/Home";
import { listGames } from "@/lib/games";

export const dynamic = "force-dynamic";

export default async function Page() {
  const games = await listGames();
  return <Home games={games} />;
}
