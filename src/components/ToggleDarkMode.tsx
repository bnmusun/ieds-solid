import { createSignal, createEffect } from "solid-js";

export default function ToggleDarkMode() {
  // We execute the logic immediately to get the boolean value
  const getInitialTheme = (): boolean => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  };

  const [isDarkMode, setIsDarkMode] = createSignal<boolean>(getInitialTheme());

  createEffect(() => {
    const html = document.documentElement;
    const dark = isDarkMode();

    if (dark) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  });

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  return (
    <div
      onClick={toggleDarkMode}
      class="relative w-14 h-8 rounded-3xl bg-slate-300 dark:bg-zinc-700 cursor-pointer flex items-center transition-colors duration-300"
    >
      <div
        class="absolute top-1 rounded-full w-6 h-6 bg-blue-500 transition-all duration-300"
        // classList handles the conditional logic cleanly
        classList={{
          "left-1": isDarkMode(),
          "translate-x-6": !isDarkMode(), // Using translate for smoother animation
        }}
      />
    </div>
  );
}
