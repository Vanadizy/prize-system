// Rodline's shared hosting has a strict process/thread limit. Tailwind's native
// scanner uses Rayon, so keep its worker pool within that hosting limit.
process.env.RAYON_NUM_THREADS = "1";

const { build } = await import("vite");
await build();
