import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const params = new URLSearchParams(window.location.search);
const isTestApp = params.has('test_app') || params.get('test_app') === 'true';

let component = App;
if (isTestApp) {
    // Dynamic import to avoid bundling PWTestApp in production if we were stricter,
    // but for now synchronous import is fine as this IS the dev/test build.
    // However, top level await might be issue?
    // Let's just lazy load if we wanted, but explicit import is easier.
    component = (await import('./PWTestApp.svelte')).default as any;
}

const app = mount(component, {
    target: document.getElementById('app')!,
});

export default app;
