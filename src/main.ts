import { mount } from 'svelte'
import './app.css'
// import App from './App.svelte'
import DebugApp from './DebugApp.svelte'

const app = mount(DebugApp, {
    target: document.getElementById('app')!,
})

export default app
