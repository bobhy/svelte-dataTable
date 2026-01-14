import { mount } from 'svelte'
import './app.css'
// import App from './App.svelte'
import DebugApp from './DebugApp.svelte'
import PWTestApp from './PWTestApp.svelte'

// Check if this is a test environment
const params = new URLSearchParams(window.location.search);
const isTestApp = params.get('test_app') === 'true';

const app = mount(isTestApp ? PWTestApp : DebugApp, {
    target: document.getElementById('app')!,
})

export default app
