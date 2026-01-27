/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        svelte({ hot: !process.env.VITEST }),
        tailwindcss(),
    ],
    resolve: {
        conditions: ['browser'],
        alias: {
            $lib: path.resolve('./src/lib'),
            '$app/environment': path.resolve('./src/lib/mocks/app-environment.ts'),
            '$app/stores': path.resolve('./src/lib/mocks/app-stores.ts'),
            '$app/navigation': path.resolve('./src/lib/mocks/app-navigation.ts'),
            '$app/forms': path.resolve('./src/lib/mocks/app-forms.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,ts}'],
        setupFiles: ['src/setupTests.ts'],
        deps: {
            optimizer: {
                web: {
                    include: ['svelte', '@tanstack/svelte-table']
                }
            }
        }
    },
});
