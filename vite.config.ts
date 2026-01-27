import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
    plugins: [
        tailwindcss(),
        svelte({}),
    ],
    resolve: {
        alias: {
            $lib: resolve("./src/lib"),
            "$app/environment": resolve("./src/lib/mocks/sveltekit.ts"),
            "$app/stores": resolve("./src/lib/mocks/sveltekit.ts"),
            "$app/navigation": resolve("./src/lib/mocks/sveltekit.ts"),
            "$app/forms": resolve("./src/lib/mocks/sveltekit.ts"),
        },
    },
    build: {
        sourcemap: mode === "development" ? "inline" : false,
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    css: {
        devSourcemap: mode === "development",
    },
    optimizeDeps: {
        exclude: ["$app/environment", "$app/stores", "$app/navigation", "$app/forms", "sveltekit-superforms", "formsnap"],
    },
}));
