import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get vite alias configuration for mocking SvelteKit $app/* modules.
 * 
 * Use this in your vite.config.ts when using dataTable outside of SvelteKit:
 * 
 * ```typescript
 * import { getSveltekitMocksAlias } from 'datatable/vite';
 * 
 * export default defineConfig({
 *   resolve: {
 *     alias: {
 *       $lib: resolve("./src/lib"),
 *       ...getSveltekitMocksAlias(),
 *     },
 *   },
 * });
 * ```
 */
export function getSveltekitMocksAlias(): Record<string, string> {
    // Resolve the path to the mocks file relative to this module
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mocksPath = resolve(__dirname, '../mocks/sveltekit.ts');

    return {
        "$app/environment": mocksPath,
        "$app/stores": mocksPath,
        "$app/navigation": mocksPath,
        "$app/forms": mocksPath,
    };
}

/**
 * Recommended optimizeDeps.exclude configuration for sveltekit-superforms.
 */
export const sveltekitOptimizeDepsExclude = [
    "$app/environment",
    "$app/stores",
    "$app/navigation",
    "$app/forms",
    "sveltekit-superforms",
    "formsnap"
];
