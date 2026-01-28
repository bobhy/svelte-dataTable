---
description: How to run CLI commands in bash to avoid hanging in fish shell
---

// turbo-all

1. Issue a `bash` command to start an interactive bash shell.
2. Use `send_command_input` to provide the CLI commands (e.g., `npx shadcn-svelte@latest add ...`).
3. Monitor progress using `command_status` or by checking the filesystem for expected changes.
4. Terminate the bash session when finished if necessary, or continue using it for subsequent commands.
