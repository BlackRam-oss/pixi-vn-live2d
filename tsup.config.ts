import { defineConfig } from "tsup";

export default defineConfig([
    {
        target: "es2020",
        entry: {
            core: "src/core/index.ts",
        },
        format: ["esm"],
        dts: true,
        treeshake: true,
        clean: true,
        minify: true,
        bundle: true,
        skipNodeModulesBundle: false,
        external: ["pixi.js", "untitled-pixi-live2d-engine"],
        esbuildOptions(options) {
            options.alias = {
                ...options.alias,
                "pixi.js": "@drincs/pixi-vn/pixi.js",
            };
        },
    },
    {
        target: "es2020",
        entry: {
            index: "src/index.ts",
        },
        format: ["cjs", "esm"],
        dts: true,
        treeshake: true,
        clean: false,
        minify: true,
        bundle: true,
        skipNodeModulesBundle: false,
        external: ["@drincs/pixi-vn", "pixi.js", "@drincs/pixi-vn-live2d/core"],
        outExtension({ format }) {
            return {
                js: format === "esm" ? ".mjs" : ".cjs",
            };
        },
    },
    {
        target: "es2020",
        entry: {
            ink: "src/ink/index.ts",
        },
        format: ["cjs", "esm"],
        dts: true,
        treeshake: true,
        clean: false,
        minify: true,
        bundle: true,
        skipNodeModulesBundle: false,
        // `zod` must stay external: bundling it here would create a second `ZodType` class
        // distinct from the one `@drincs/pixi-vn-ink` uses for its `instanceof ZodType`
        // validation checks, silently breaking every hashtag command registered via
        // `createLive2DHandler` (they'd always report as invalid). `@drincs/pixi-vn-live2d` must
        // stay external too, so `Live2D` here is the same class the rest of the app imports —
        // otherwise the `RegisteredCanvasComponents.add(Live2D, ...)` side effect in the main
        // entry and any `instanceof Live2D` check would see two distinct classes.
        // `@drincs/pixi-vn-json` (and the `/core`, `/translator` submodules its `/actions`
        // subpath itself pulls in) is deliberately NOT external: it's only a devDependency of
        // this package, used solely for `executeEntranceTransition`/`entranceTransitionKeySchemas`,
        // so it gets bundled straight into `dist/ink.*` — consumers of `@drincs/pixi-vn-live2d/ink`
        // don't need to install it themselves.
        external: [
            "@drincs/pixi-vn",
            "@drincs/pixi-vn/canvas",
            "@drincs/pixi-vn-live2d",
            "@drincs/pixi-vn-ink",
            "zod",
            "pixi.js",
        ],
        outExtension({ format }) {
            return {
                js: format === "esm" ? ".mjs" : ".cjs",
            };
        },
    },
]);
