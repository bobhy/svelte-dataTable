import { sveltePreprocess } from 'svelte-preprocess'

const isProductionBuild = process.env.npm_lifecycle_event === 'build' || process.argv.includes('build');

export default {
    preprocess: sveltePreprocess({ sourceMap: !isProductionBuild })
}
