import { Composer } from "@/components/composer/Composer";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#composer">
        Skip to the composer
      </a>
      <header className="app-header">
        <h1>EVAWAVE</h1>
        <p>Compose musical intent once; compile it for Suno, ElevenLabs Music and Google Flow Music. Pre-alpha.</p>
      </header>
      <main id="composer">
        <Composer />
      </main>
    </>
  );
}
