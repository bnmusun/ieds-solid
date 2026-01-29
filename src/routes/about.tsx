import { A } from "@solidjs/router";

export default function About() {
  return (
    <main class="text-center h-screen mx-auto p-4 bg-zinc-50 font-sans dark:bg-zinc-950 dark:text-white">
      <h1 class="text-3xl font-bold tracking-tight text-zinc-600 dark:text-zinc-400">
        About
      </h1>
      <p class="my-4 text-zinc-600 dark:text-zinc-400 text-sm tracking-wider">
        IEDS (Iterated Elimination of Dominated Strategies) program
      </p>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          Home
        </A>
      </p>
    </main>
  );
}
