import { Converter } from 'typedoc';

/**
 * TypeDoc Plugin: Default Link (Inline Version)
 * 
 * Resolves {@defaultLink Constant.prop} and injects the actual value.
 */
export function load(app) {
    app.converter.on(Converter.EVENT_RESOLVE, (context, reflection) => {
        const comment = reflection.comment;
        if (!comment) return;

        if (comment.summary) {
            comment.summary = processParts(context, comment.summary, reflection);
        }
        for (const tag of comment.blockTags) {
            tag.content = processParts(context, tag.content, reflection);
        }
    });

    function findReflection(project, path) {
        const parts = path.split('.');
        let current = project;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current) return undefined;

            // 1. Try direct child
            let target = current.children?.find(c => c.name === part);

            // 2. If not found, check if current node has a type declaration with children
            // (This handles object literals: Variable -> type -> declaration -> children)
            if (!target && current.type && current.type.declaration && current.type.declaration.children) {
                target = current.type.declaration.children.find(c => c.name === part);
            }

            // 3. Fallback: Search all modules if checking root
            if (!target && i === 0 && current === project) {
                const potentialModules = current.children?.filter(c => c.kindString === 'Module' || c.kind === 1 || c.kind === 2);
                for (const mod of potentialModules || []) {
                    target = mod.children?.find(c => c.name === part);
                    if (target) break;
                }
            }

            current = target;
        }
        return current;
    }

    function processParts(context, parts, reflection) {
        const newParts = [];

        for (const part of parts) {
            if (part.kind === 'inline-tag' && part.tag === '@defaultLink') {
                const linkPath = part.text.trim();
                const target = findReflection(context.project, linkPath);

                if (target) {
                    let value = target.defaultValue;

                    if (!value && target.type) {
                        if (target.type.type === 'literal') {
                            value = String(target.type.value);
                        }
                    }

                    if (value) {
                        value = value.trim();
                        //if (value.includes('=>')) {
                        //    const match = value.match(/=>\s*(.*)/);
                        //    if (match) value = match[1].trim();
                        //}
                        //if ((value.startsWith("'") && value.endsWith("'")) ||
                        //    (value.startsWith('"') && value.endsWith('"'))) {
                        //    value = value.slice(1, -1);
                        //}

                        newParts.push({ kind: 'text', text: `Default: \`${value}\` (` });
                        newParts.push({
                            kind: 'inline-tag',
                            tag: '@link',
                            text: linkPath,
                            target: target
                        });
                        newParts.push({ kind: 'text', text: ')' });
                        continue;
                    }
                }

                // Fallback
                newParts.push({
                    kind: 'inline-tag',
                    tag: '@link',
                    text: linkPath
                });
            } else {
                newParts.push(part);
            }
        }
        return newParts;
    }
}
