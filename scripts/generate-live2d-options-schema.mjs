#!/usr/bin/env node
/**
 * Generates the JSON Schema used by `createLive2DHandler`'s `# show live2d` `keySchemas` (its
 * numeric position key, see `src/ink/live2dHandler.ts`) from `Live2DOptions`
 * (src/interfaces/Live2DOptions.ts), via `@drincs/pixi-vn-json`'s own generic
 * TypeScript-interface-to-JSON-Schema generator (`schema-generator.mjs`) — the same generator
 * `@drincs/pixi-vn-json` itself uses to produce `entranceTransitionKeySchemas`.
 *
 * `Live2DOptions` is generated via the depth-capped "external" path (no `interfaceDir` passed):
 * the type checker's fully-resolved `ts.Type` already flattens `extends`/intersections correctly,
 * so every inherited property (`checkMocConsistency`, the `ContainerOptions` fields, ...) comes
 * through, without needing the AST-only "local" path to understand the `extends` clause itself.
 *
 * Run via `npm run generate-live2d-options-schema`; re-run whenever `Live2DOptions` (or the
 * `@drincs/pixi-vn`/`untitled-pixi-live2d-engine` types it derives from) changes.
 *
 * `source` is dropped from the generated schema: neither `# show live2d` command (see
 * `createLive2DHandler`) takes it as a `<key> <value>` prop — one uses `<alias>` as the source,
 * the other takes `<source>` as its own positional token — so it would never legitimately appear
 * among the free-form props this schema validates.
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateJsonSchema } from "@drincs/pixi-vn-json/schema-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const live2DOptionsFile = join(rootDir, "src", "interfaces", "Live2DOptions.ts");

const { schemas, definitions } = generateJsonSchema({
    rootFiles: [live2DOptionsFile],
    rootTypeNames: ["Live2DOptions"],
    tsconfigPath: join(rootDir, "tsconfig.json"),
});

/** Must be self-contained (it's used standalone as one JSON Schema by any validator). */
function toStandaloneSchema(rootSchema) {
    if (rootSchema.$ref) {
        const key = rootSchema.$ref.replace("#/definitions/", "");
        const { [key]: own, ...rest } = definitions;
        const usedRefs = JSON.stringify(own).match(/#\/definitions\/[A-Za-z0-9_]+/g) ?? [];
        if (usedRefs.length === 0) return own;
        const neededDefinitions = Object.fromEntries(
            usedRefs
                .map((ref) => ref.replace("#/definitions/", ""))
                .filter((k) => k in rest)
                .map((k) => [k, rest[k]]),
        );
        return Object.keys(neededDefinitions).length > 0
            ? { ...own, definitions: neededDefinitions }
            : own;
    }
    return rootSchema;
}

const live2DOptionsSchema = toStandaloneSchema(schemas.Live2DOptions);

/** Drops `source` (see the header comment above for why). */
function withoutSource(schema) {
    const { source, ...properties } = schema.properties ?? {};
    return {
        ...schema,
        properties,
        required: (schema.required ?? []).filter((key) => key !== "source"),
    };
}

const outPath = join(rootDir, "src", "ink", "live2d-options-schema.generated.ts");
const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Produced by \`scripts/generate-live2d-options-schema.mjs\` from \`Live2DOptions\`
 * (src/interfaces/Live2DOptions.ts). Re-run that script (see its header comment) to refresh this
 * file after that interface (or the types it derives from) changes.
 */

/**
 * JSON Schema (usable as \`@drincs/pixi-vn-ink\`'s \`HashtagHandlerOptions.keySchemas\` values, or
 * with any other JSON Schema validator) for \`Live2DOptions\`.
 */
export const live2DOptionsSchema: object = `;

writeFileSync(
    outPath,
    `${banner}${JSON.stringify(withoutSource(live2DOptionsSchema), null, 4)};\n`,
);

console.log(`Generated: ${outPath}`);
