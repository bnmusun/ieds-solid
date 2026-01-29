import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="text-center h-screen mx-auto p-4 bg-zinc-50 font-sans dark:bg-zinc-950 dark:text-white">
      <h1 class="text-3xl font-bold tracking-tight text-zinc-600 dark:text-zinc-400">
        Not Found
      </h1>

      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          Home
        </A>
        {" - "}
        <A href="/about" class="text-sky-600 hover:underline">
          About Page
        </A>
      </p>
    </main>
  );
}
