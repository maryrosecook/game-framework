import { notFound } from "next/navigation";
import { App } from "@/components/App";
import { gameSlug, listGames } from "@/lib/games";

type PageProps = {
  params: { game: string };
};

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: PageProps) {
  const slug = gameSlug(params.game);
  if (!slug) {
    notFound();
  }

  const availableGames = await listGames();
  const resolvedGame =
    availableGames.find((game) => gameSlug(game) === slug) ?? null;
  if (!resolvedGame) {
    notFound();
  }

  return <App key={resolvedGame} gameDirectory={resolvedGame} />;
}
