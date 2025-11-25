import { Game } from "@/components/Game";

type AppProps = {
  gameDirectory: string;
};

export function App({ gameDirectory }: AppProps) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <Game gameDirectory={gameDirectory} />
    </main>
  );
}
