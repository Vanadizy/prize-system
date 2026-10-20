// Rodline's shared hosting has a strict process/thread limit. Tailwind's native
// scanner uses Rayon, and esbuild uses Go's runtime worker pool, so cap both.
process.env.RAYON_NUM_THREADS = "1";
process.env.GOMAXPROCS = "1";

const { build } = await import("vite");
await build();
