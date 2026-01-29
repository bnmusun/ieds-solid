export default function Home() {
  const navigateTo = (path: string) => {
    // window.location.assign(path);
    // '_blank' tells the browser to open a new tab/window
    // 'noopener,noreferrer' is a security best practice
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    // Changed justify-center to justify-start on mobile, but added pt-12 for desktop spacing
    <div class="flex min-h-screen flex-col items-center justify-start md:pt-24 pt-12 bg-zinc-50 p-6 font-sans dark:bg-zinc-950 dark:text-white">
      <div class="w-full max-w-3xl space-y-12 text-center">
        <header class="space-y-1">
          {/* Reduced text size from 6xl to 4xl on mobile and 5xl on desktop */}
          <h1 class="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100 uppercase">
            IEDS SOLVER
          </h1>
          <p class="text-sm md:text-base text-zinc-500 dark:text-zinc-400 font-medium my-6">
            Select an exploration algorithm to begin.
          </p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          {/* BFS BUTTON */}
          <button
            onClick={() => navigateTo("/indexbfs")}
            class="group flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-blue-500 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
          >
            <h2 class="text-xl font-bold tracking-tight text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 transition-colors">
              BFS{" "}
              <span class="text-sm font-normal block mt-1">
                (Breadth-First Search)
              </span>
            </h2>
          </button>

          {/* DFS BUTTON */}
          <button
            onClick={() => navigateTo("/indexdfs")}
            class="group flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-purple-500 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
          >
            <h2 class="text-xl font-bold tracking-tight text-zinc-500 dark:text-zinc-400 group-hover:text-purple-500 transition-colors">
              DFS{" "}
              <span class="text-sm font-normal block mt-1">
                (Depth-First Search)
              </span>
            </h2>
          </button>
        </div>
      </div>
    </div>
  );
}
