import { createSignal, For, Show, createMemo, onCleanup } from "solid-js";

type Payoff = [number, number];
type Matrix = Payoff[][];

interface GameStep {
  path: string;
  matrixSnapshot: Matrix;
  currentRowIndices: number[];
  currentColIndices: number[];
  logs: string[];
  result?: string;
  occurrenceCount?: number;
}

export default function Home() {
  const [workflow, setWorkflow] = createSignal<GameStep[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [processedCount, setProcessedCount] = createSignal(0);
  const [fileName, setFileName] = createSignal<string | null>(null);
  const [currentTab, setCurrentTab] = createSignal<
    "all" | "solutions" | "unique"
  >("all");
  const [shouldStop, setShouldStop] = createSignal(false);

  const [startTime, setStartTime] = createSignal<number | null>(null);
  const [currentTime, setCurrentTime] = createSignal<number | null>(null);
  const [firstEquilibriumTime, setFirstEquilibriumTime] = createSignal<
    number | null
  >(null);
  const [firstDeadEndTime, setFirstDeadEndTime] = createSignal<number | null>(
    null,
  );
  let timerInterval: number | undefined;

  let stepsRecord: GameStep[] = [];
  let fileInputRef: HTMLInputElement | undefined;

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${mins}m ${secs}s ${millis}ms`;
  };

  const elapsedTime = createMemo(() => {
    const start = startTime();
    const now = currentTime();
    if (start === null || now === null) return "0m 0s 0ms";
    return formatTime(now - start);
  });

  const firstEquilibriumElapsed = createMemo(() => {
    const start = startTime();
    const first = firstEquilibriumTime();
    if (start === null || first === null) return null;
    return formatTime(first - start);
  });

  const firstDeadEndElapsed = createMemo(() => {
    const start = startTime();
    const first = firstDeadEndTime();
    if (start === null || first === null) return null;
    return formatTime(first - start);
  });

  const topSolutions = createMemo(() => {
    const allResults = workflow().filter((step) => step.result);
    const sorted = allResults.sort((a, b) => {
      const isAEquilibrium =
        a.currentRowIndices.length === 1 && a.currentColIndices.length === 1;
      const isBEquilibrium =
        b.currentRowIndices.length === 1 && b.currentColIndices.length === 1;
      if (isAEquilibrium && !isBEquilibrium) return -1;
      if (!isAEquilibrium && isBEquilibrium) return 1;
      const sizeA = a.currentRowIndices.length * a.currentColIndices.length;
      const sizeB = b.currentRowIndices.length * b.currentColIndices.length;
      if (sizeA !== sizeB) return sizeA - sizeB;
      const pathALength = a.path.split("->").length;
      const pathBLength = b.path.split("->").length;
      if (pathALength !== pathBLength) return pathBLength - pathALength;
      return 0;
    });
    return sorted;
  });

  const uniqueSolutions = createMemo(() => {
    const solutions = topSolutions();
    const uniqueMap = new Map<string, { step: GameStep; count: number }>();
    solutions.forEach((step) => {
      const key = `R:[${[...step.currentRowIndices].sort().join(",")}]|C:[${[...step.currentColIndices].sort().join(",")}]`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { step: { ...step }, count: 1 });
      } else {
        const entry = uniqueMap.get(key)!;
        entry.count += 1;
        const currentPathLen = step.path.split("->").length;
        const existingPathLen = entry.step.path.split("->").length;
        if (currentPathLen < existingPathLen) entry.step = { ...step };
      }
    });
    return Array.from(uniqueMap.values()).map((item) => ({
      ...item.step,
      occurrenceCount: item.count,
    }));
  });

  const parseLine = (line: string): Payoff[] => {
    const values = line.split(";");
    return values.map((val) => {
      const parts = val.replace(/[()]/g, "").split(",");
      return [parseFloat(parts[0].trim()), parseFloat(parts[1].trim())];
    });
  };

  const stopTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
  };

  const handleClear = () => {
    setWorkflow([]);
    stepsRecord = [];
    setProcessedCount(0);
    setFileName(null);
    setShouldStop(false);
    setStartTime(null);
    setCurrentTime(null);
    setFirstEquilibriumTime(null);
    setFirstDeadEndTime(null);
    stopTimer();
    if (fileInputRef) fileInputRef.value = "";
  };

  const handleStop = () => {
    setShouldStop(true);
    setIsLoading(false);
    stopTimer();
  };

  const handleFileUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setShouldStop(false);
    setProcessedCount(0);
    setFirstEquilibriumTime(null);
    setFirstDeadEndTime(null);

    const start = performance.now();
    setStartTime(start);
    setCurrentTime(start);
    timerInterval = window.setInterval(
      () => setCurrentTime(performance.now()),
      50,
    );

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const matrix: Matrix = content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => parseLine(line.trim()));

      const initialRows = Array.from(matrix.keys());
      const initialCols = Array.from(matrix[0].keys());

      stepsRecord = [
        {
          path: "Initial Game Matrix",
          matrixSnapshot: matrix,
          currentRowIndices: initialRows,
          currentColIndices: initialCols,
          logs: ["Initial state loaded."],
        },
      ];

      startAsyncSolver(matrix, initialRows, initialCols, "Start");
    };
    reader.readAsText(file);
  };

  const startAsyncSolver = (
    matrix: Matrix,
    rows: number[],
    cols: number[],
    path: string,
  ) => {
    const stack: { matrix: Matrix; r: number[]; c: number[]; p: string }[] = [
      { matrix, r: rows, c: cols, p: path },
    ];
    const batchSize = 25;

    const processBatch = () => {
      if (shouldStop()) {
        setWorkflow([...stepsRecord]);
        stopTimer();
        return;
      }

      if (stack.length === 0) {
        setWorkflow([...stepsRecord]);
        setIsLoading(false);
        stopTimer();
        setCurrentTime(performance.now());
        return;
      }

      for (let i = 0; i < batchSize && stack.length > 0; i++) {
        const current = stack.pop()!;
        solve_game_step(current.matrix, current.r, current.c, current.p, stack);
        setProcessedCount((prev) => prev + 1);
      }

      setWorkflow([...stepsRecord]);
      setTimeout(processBatch, 0);
    };

    processBatch();
  };

  const get_strictly_dominated = (
    matrix: Matrix,
    row_indices: number[],
    col_indices: number[],
    is_row_player: boolean,
  ) => {
    const dominated_pairs: [number, number][] = [];
    if (is_row_player) {
      for (const r_a of row_indices) {
        for (const r_b of row_indices) {
          if (r_a === r_b) continue;
          if (col_indices.every((c) => matrix[r_a][c][0] < matrix[r_b][c][0])) {
            dominated_pairs.push([r_a, r_b]);
            break;
          }
        }
      }
    } else {
      for (const c_a of col_indices) {
        for (const c_b of col_indices) {
          if (c_a === c_b) continue;
          if (row_indices.every((r) => matrix[r][c_a][1] < matrix[r][c_b][1])) {
            dominated_pairs.push([c_a, c_b]);
            break;
          }
        }
      }
    }
    return dominated_pairs;
  };

  const get_weakly_dominated_options = (
    matrix: Matrix,
    row_indices: number[],
    col_indices: number[],
    is_row_player: boolean,
  ) => {
    const options: [number, number][] = [];
    if (is_row_player) {
      for (const r_a of row_indices) {
        for (const r_b of row_indices) {
          if (r_a === r_b) continue;
          const better_or_equal = col_indices.every(
            (c) => matrix[r_b][c][0] >= matrix[r_a][c][0],
          );
          const strictly_better = col_indices.some(
            (c) => matrix[r_b][c][0] > matrix[r_a][c][0],
          );
          if (better_or_equal && strictly_better) {
            options.push([r_a, r_b]);
            break;
          }
        }
      }
    } else {
      for (const c_a of col_indices) {
        for (const c_b of col_indices) {
          if (c_a === c_b) continue;
          const better_or_equal = row_indices.every(
            (r) => matrix[r][c_b][1] >= matrix[r][c_a][1],
          );
          const strictly_better = row_indices.some(
            (r) => matrix[r][c_b][1] > matrix[r][c_a][1],
          );
          if (better_or_equal && strictly_better) {
            options.push([c_a, c_b]);
            break;
          }
        }
      }
    }
    return options;
  };

  const get_very_weakly_dominated_options = (
    matrix: Matrix,
    row_indices: number[],
    col_indices: number[],
    is_row_player: boolean,
  ) => {
    const options: [number, number][] = [];
    if (is_row_player) {
      for (const r_a of row_indices) {
        for (const r_b of row_indices) {
          if (r_a === r_b) continue;
          // Strategy A is very weakly dominated by B if B is >= A in all cases
          if (
            col_indices.every((c) => matrix[r_b][c][0] >= matrix[r_a][c][0])
          ) {
            options.push([r_a, r_b]);
            break;
          }
        }
      }
    } else {
      for (const c_a of col_indices) {
        for (const c_b of col_indices) {
          if (c_a === c_b) continue;
          if (
            row_indices.every((r) => matrix[r][c_b][1] >= matrix[r][c_a][1])
          ) {
            options.push([c_a, c_b]);
            break;
          }
        }
      }
    }
    return options;
  };

  const solve_game_step = (
    matrix: Matrix,
    row_indices: number[],
    col_indices: number[],
    path: string,
    stack: any[],
  ) => {
    const current_rows = [...row_indices];
    const current_cols = [...col_indices];

    // 1. Check Strict Domination
    const s_rows = get_strictly_dominated(
      matrix,
      current_rows,
      current_cols,
      true,
    );
    if (s_rows.length > 0) {
      const [dom, by] = s_rows[0];
      const next_rows = current_rows.filter((r) => r !== dom);
      const newPath = `${path} -> R${dom} Strict Dom by R${by}`;
      stepsRecord.push({
        path: newPath,
        matrixSnapshot: matrix,
        currentRowIndices: next_rows,
        currentColIndices: current_cols,
        logs: [],
      });
      stack.push({ matrix, r: next_rows, c: current_cols, p: newPath });
      return;
    }

    const s_cols = get_strictly_dominated(
      matrix,
      current_rows,
      current_cols,
      false,
    );
    if (s_cols.length > 0) {
      const [dom, by] = s_cols[0];
      const next_cols = current_cols.filter((c) => c !== dom);
      const newPath = `${path} -> C${dom} Strict Dom by C${by}`;
      stepsRecord.push({
        path: newPath,
        matrixSnapshot: matrix,
        currentRowIndices: current_rows,
        currentColIndices: next_cols,
        logs: [],
      });
      stack.push({ matrix, r: current_rows, c: next_cols, p: newPath });
      return;
    }

    // 2. Check Weak Domination
    const w_rows = get_weakly_dominated_options(
      matrix,
      current_rows,
      current_cols,
      true,
    );
    const w_cols = get_weakly_dominated_options(
      matrix,
      current_rows,
      current_cols,
      false,
    );

    if (w_rows.length > 0 || w_cols.length > 0) {
      for (const [strat, dominator] of w_rows) {
        const next_rows = current_rows.filter((r) => r !== strat);
        const newPath = `${path} -> R${strat} Weakly Dom by R${dominator}`;
        stepsRecord.push({
          path: newPath,
          matrixSnapshot: matrix,
          currentRowIndices: next_rows,
          currentColIndices: current_cols,
          logs: [],
        });
        stack.push({ matrix, r: next_rows, c: current_cols, p: newPath });
      }
      for (const [strat, dominator] of w_cols) {
        const next_cols = current_cols.filter((c) => c !== strat);
        const newPath = `${path} -> C${strat} Weakly Dom by C${dominator}`;
        stepsRecord.push({
          path: newPath,
          matrixSnapshot: matrix,
          currentRowIndices: current_rows,
          currentColIndices: next_cols,
          logs: [],
        });
        stack.push({ matrix, r: current_rows, c: next_cols, p: newPath });
      }
      return;
    }

    // 3. Check Very Weak Domination
    const vw_rows = get_very_weakly_dominated_options(
      matrix,
      current_rows,
      current_cols,
      true,
    );
    const vw_cols = get_very_weakly_dominated_options(
      matrix,
      current_rows,
      current_cols,
      false,
    );

    if (vw_rows.length > 0 || vw_cols.length > 0) {
      for (const [strat, dominator] of vw_rows) {
        const next_rows = current_rows.filter((r) => r !== strat);
        const newPath = `${path} -> R${strat} Very Weakly Dom by R${dominator}`;
        stepsRecord.push({
          path: newPath,
          matrixSnapshot: matrix,
          currentRowIndices: next_rows,
          currentColIndices: current_cols,
          logs: [],
        });
        stack.push({ matrix, r: next_rows, c: current_cols, p: newPath });
      }
      for (const [strat, dominator] of vw_cols) {
        const next_cols = current_cols.filter((c) => c !== strat);
        const newPath = `${path} -> C${strat} Very Weakly Dom by C${dominator}`;
        stepsRecord.push({
          path: newPath,
          matrixSnapshot: matrix,
          currentRowIndices: current_rows,
          currentColIndices: next_cols,
          logs: [],
        });
        stack.push({ matrix, r: current_rows, c: next_cols, p: newPath });
      }
      return;
    }

    // Termination (Equilibrium or Dead End)
    const targetStep = stepsRecord.find((s) => s.path === path);
    if (targetStep) {
      if (current_rows.length === 1 && current_cols.length === 1) {
        targetStep.result = `EQUILIBRIUM: R${current_rows[0]}, C${current_cols[0]}`;
        if (firstEquilibriumTime() === null)
          setFirstEquilibriumTime(performance.now());
      } else {
        targetStep.result = `DEAD END: Matrix size ${current_rows.length}x${current_cols.length}`;
        if (firstDeadEndTime() === null) setFirstDeadEndTime(performance.now());
      }
    }
  };

  const MatrixTable = (props: { step: GameStep }) => (
    <div class="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex items-center justify-between border-b pb-2">
        <h2 class="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 break-all pr-4">
          {props.step.path}
        </h2>
        <Show when={props.step.occurrenceCount !== undefined}>
          <div class="shrink-0 bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">
            Paths: {props.step.occurrenceCount}
          </div>
        </Show>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-zinc-200 border text-xs dark:divide-zinc-800">
          <thead class="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th class="px-3 py-1 border text-zinc-600 dark:text-zinc-400"></th>
              <For each={props.step.currentColIndices}>
                {(c) => (
                  <th class="px-3 py-1 border font-mono text-zinc-600 dark:text-zinc-400">
                    C{c}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.step.currentRowIndices}>
              {(r) => (
                <tr>
                  <td class="px-3 py-1 border bg-zinc-50 font-bold dark:bg-zinc-800 font-mono text-zinc-600 dark:text-zinc-400">
                    R{r}
                  </td>
                  <For each={props.step.currentColIndices}>
                    {(c) => (
                      <td class="px-3 py-1 border text-center text-zinc-600 dark:text-zinc-400">
                        (
                        <span class="text-red-600">
                          {props.step.matrixSnapshot[r][c][0]}
                        </span>
                        ,
                        <span class="text-green-600">
                          {props.step.matrixSnapshot[r][c][1]}
                        </span>
                        )
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <Show when={props.step.result}>
        <div
          class={`mt-2 p-2 rounded text-xs font-bold ${props.step.result?.includes("EQUILIBRIUM") ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
        >
          {props.step.result}
        </div>
      </Show>
    </div>
  );

  onCleanup(() => stopTimer());

  return (
    <div class="flex min-h-screen flex-col items-center bg-zinc-50 p-4 font-sans dark:bg-zinc-950 dark:text-white">
      <main class="w-full max-w-5xl space-y-6">
        <section class="space-y-4">
          <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            IEDS Program - Depth-First Search (DFS)
          </h1>
          <div class="flex flex-wrap items-center gap-4">
            <Show when={!fileName()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onInput={handleFileUpload}
                class="text-sm text-black dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-zinc-200 file:text-black dark:file:bg-zinc-800 dark:file:text-white"
              />
            </Show>

            <Show
              when={isLoading()}
              fallback={
                <Show when={workflow().length > 0}>
                  <button
                    onClick={handleClear}
                    class="px-4 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  >
                    Clear Results
                  </button>
                </Show>
              }
            >
              <button
                onClick={handleStop}
                class="px-4 py-2 text-sm bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors font-bold"
              >
                Stop Execution
              </button>
            </Show>

            <Show when={isLoading()}>
              <span class="text-sm text-blue-600 animate-pulse">
                Explored: {processedCount()}
              </span>
            </Show>

            <Show when={fileName()}>
              <div class="flex flex-col gap-2">
                <span class="text-xs text-zinc-500 italic">
                  File: {fileName()}
                </span>

                <div class="flex flex-wrap items-center gap-4">
                  <div class="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                      Total Time:
                    </span>
                    <span class="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {elapsedTime()}
                    </span>
                  </div>

                  <Show when={firstEquilibriumElapsed()}>
                    <div class="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800/50">
                      <span class="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tight">
                        First Equilibrium:
                      </span>
                      <span class="text-xs font-mono font-bold text-green-700 dark:text-green-300">
                        {firstEquilibriumElapsed()}
                      </span>
                    </div>
                  </Show>

                  <Show when={firstDeadEndElapsed()}>
                    <div class="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-full border border-amber-200 dark:border-amber-800/50">
                      <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight">
                        First Dead End:
                      </span>
                      <span class="text-xs font-mono font-bold text-amber-700 dark:text-zinc-300">
                        {firstDeadEndElapsed()}
                      </span>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </section>

        <div class="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setCurrentTab("all")}
            class={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${currentTab() === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}
          >
            All Exploration Steps ({workflow().length})
          </button>
          <button
            onClick={() => setCurrentTab("solutions")}
            class={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${currentTab() === "solutions" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}
          >
            Top Solutions ({topSolutions().length})
          </button>
          <button
            onClick={() => setCurrentTab("unique")}
            class={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${currentTab() === "unique" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}
          >
            Top Unique Solutions ({uniqueSolutions().length})
          </button>
        </div>

        <div class="space-y-8">
          <Show when={currentTab() === "all"}>
            <div class="grid grid-cols-1 gap-6">
              <For each={workflow()}>
                {(step) => <MatrixTable step={step} />}
              </For>
            </div>
          </Show>
          <Show when={currentTab() === "solutions"}>
            <div class="grid grid-cols-1 gap-6">
              <Show when={topSolutions().length === 0}>
                <p class="text-center text-zinc-500 py-10">
                  {isLoading()
                    ? "Analyzing matrix..."
                    : "No solutions found yet. Upload a file to begin."}
                </p>
              </Show>
              <For each={topSolutions()}>
                {(step) => <MatrixTable step={step} />}
              </For>
            </div>
          </Show>
          <Show when={currentTab() === "unique"}>
            <div class="grid grid-cols-1 gap-6">
              <Show when={uniqueSolutions().length === 0}>
                <p class="text-center text-zinc-500 py-10">
                  {isLoading()
                    ? "Grouping unique results..."
                    : "No unique solutions found."}
                </p>
              </Show>
              <For each={uniqueSolutions()}>
                {(step) => <MatrixTable step={step} />}
              </For>
            </div>
          </Show>
        </div>
      </main>
    </div>
  );
}
