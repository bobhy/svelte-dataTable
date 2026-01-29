/**
 * @file
 * @description
 * This plugin processes @defaultLink tags in TypeDoc comments.
 * These tags expand to the string `Default: <actualValue>.
 * By uncommenting a few lines in the body, they could be: `Default: <actualValue> (<linkToDeclaration>)`.
 * 
 * See {@link https://github.com/bobhy/dataTable/blob/main/src/lib/components/ui/datatable/FooTypes.ts} for sample usage.
 * 
 * @module typedoc-plugin-default-link
 */
import { Converter } from 'typedoc';
import * as fs from 'fs';

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

    function extractValueFromSource(target) {
        if (!target.sources || target.sources.length === 0) return null;

        try {
            const source = target.sources[0];
            if (!fs.existsSync(source.fullFileName)) return null;

            const content = fs.readFileSync(source.fullFileName, 'utf-8');
            const lines = content.split(/\r?\n/);

            // Validate line coverage
            if (source.line < 1 || source.line > lines.length) return null;

            // line is 1-based
            let currentLineIdx = source.line - 1;
            const lineText = lines[currentLineIdx];

            // Regex to find "key: value" or "key = value"
            // We want to capture the value part.
            const propRegex = new RegExp(`\\b${target.name}\\s*[:=]\\s*(.*)`);
            const match = lineText.match(propRegex);

            if (match) {
                let value = match[1].trim();
                // Strip trailing comma if present
                if (value.endsWith(',')) {
                    value = value.substring(0, value.length - 1).trim();
                }
                return value;
            }
        } catch (e) {
            console.warn(`[defaultLink] Error reading source for ${target.name}:`, e);
        }
        return null;
    }

    function processParts(context, parts, reflection) {
        const newParts = [];

        for (const part of parts) {
            if (part.kind === 'inline-tag' && part.tag === '@defaultLink') {
                const linkPath = part.text.trim();
                const target = findReflection(context.project, linkPath);

                if (target) {
                    let value = target.defaultValue;
                    // console.log(`[DEBUG] Inspecting ${linkPath}: defaultValue="${value}"`);

                    // Work a bit to get accurate default value string for arror functions
                    // Force extraction if value is missing, "...", or looks like a TypeDoc Type string
                    const needsExtraction =
                        !value ||
                        value === '...' ||
                        value.includes('=>'); // often a type signature in TypeDoc, not code

                    if (needsExtraction && target.sources) {
                        //console.log(`[DEBUG] Attempting source extraction for ${linkPath}`);
                        const extracted = extractValueFromSource(target);
                        if (extracted) {
                            value = extracted;
                            //console.log(`[DEBUG] Extracted: ${value}`);
                        } else {
                            console.warn(`[WARN] Extraction FAILED for ${linkPath}. target.sources: ${JSON.stringify(target.sources)}`);
                        }
                    }

                    if (!value && target.type && target.type.type === 'literal') {
                        value = String(target.type.value);
                    }

                    if (value) {
                        value = value.trim();

                        newParts.push({ kind: 'text', text: `Default: \`${value}\`` });
                        //newParts.push( {kind: 'text', text: ' ('})
                        //newParts.push({
                        //    kind: 'inline-tag',
                        //    tag: '@link',
                        //    text: linkPath,
                        //    target: target
                        //});
                        //newParts.push({ kind: 'text', text: ')' });
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
