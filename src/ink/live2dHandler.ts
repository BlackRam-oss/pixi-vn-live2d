import { live2DOptionsSchema } from "@/ink/live2d-options-schema.generated";
import { logger } from "@/utils/log-utility";
import { canvas } from "@drincs/pixi-vn";
import { HashtagCommands } from "@drincs/pixi-vn-ink";
import { Live2D } from "@drincs/pixi-vn-live2d";
import type { Live2DOptions } from "@drincs/pixi-vn-live2d";
import type { MotionPriority } from "@drincs/pixi-vn-live2d/core";
import {
    containerMemorySchema,
    ENTRANCE_TRANSITION_TYPES,
    entranceTransitionKeySchemas,
    type EntranceTransitionType,
    executeEntranceTransition,
} from "@drincs/pixi-vn-json/actions";
import {
    moveOut,
    pushOut,
    removeWithDissolve,
    removeWithFade,
    zoomOut,
} from "@drincs/pixi-vn/canvas";
import { z } from "zod";

/**
 * `live2DOptionsSchema` (generated from `Live2DOptions`, which itself omits `source` — see
 * `scripts/generate-live2d-options-schema.mjs`) never has a `source` key, since neither
 * `# show live2d` command takes it as a `<key> <value>` prop: one uses `<alias>` as the source,
 * the other takes `<source>` as its own positional token.
 */
const live2DOptionsPropertyKeys = new Set(
    Object.keys((live2DOptionsSchema as { properties: Record<string, object> }).properties),
);

/**
 * Tells apart `# show live2d <alias> [<key> <value> …]` (`<alias>` doubles as the source) from
 * `# show live2d <alias> <source> [<key> <value> …]` (an explicit, separate `<source>`): the token
 * right after `<alias>` is either the start of the free-form props (a recognized
 * `Live2DOptions` key), the `with` transition keyword, absent (no tail at all), or — only then —
 * an explicit `<source>`.
 */
function isPropsOrWithToken(token: string | undefined): boolean {
    return token === undefined || token === "with" || live2DOptionsPropertyKeys.has(token);
}

/**
 * The transition types used to remove a canvas element **out** (as opposed to
 * `dissolve`/`fade`/`movein`/`zoomin`/`pushin`, used only to bring one in). Mirrors
 * `@drincs/pixi-vn-json/actions`' own `ENTRANCE_TRANSITION_TYPES`, but for `# remove live2d`.
 */
const EXIT_TRANSITION_TYPES = ["dissolve", "fade", "moveout", "zoomout", "pushout"] as const;
type ExitTransitionType = (typeof EXIT_TRANSITION_TYPES)[number];

/**
 * Runs an exit transition on a canvas element, mirroring `@drincs/pixi-vn-json/actions`'
 * `executeEntranceTransition` but for removal — `@drincs/pixi-vn-json` doesn't (yet) expose an
 * equivalent helper for the exit direction, so this dispatches straight to `@drincs/pixi-vn/canvas`.
 */
function executeExitTransition(
    alias: string,
    transitionType: ExitTransitionType,
    props?: object,
): string[] | undefined {
    switch (transitionType) {
        case "dissolve":
            return removeWithDissolve(alias, props);
        case "fade":
            return removeWithFade(alias, props);
        case "moveout":
            return moveOut(alias, props);
        case "zoomout":
            return zoomOut(alias, props);
        case "pushout":
            return pushOut(alias, props);
    }
}

/** Mirrors {@link Live2D.motion}'s own inline options type (minus the `onFinish`/`onError`
 * callbacks, which can't be expressed as `<key> <value>` ink props). */
const playMotionOptionsSchema = {
    type: "object",
    properties: {
        index: { type: "number" },
        priority: { type: "number" },
        sound: { type: "string" },
        volume: { type: "number" },
        expression: { type: ["number", "string"] },
        resetExpression: { type: "boolean" },
    },
    additionalProperties: false,
};

type PlayMotionOptions = {
    index?: number;
    priority?: MotionPriority;
    sound?: string;
    volume?: number;
    expression?: number | string;
    resetExpression?: boolean;
};

/**
 * Splits the tail (everything after `<alias>`) of a `# show live2d` command into its free-form
 * construction props and an optional entrance transition.
 */
export function parseShowLive2DTail(tail: string[]): {
    propsList: string[];
    transitionType?: EntranceTransitionType;
    transitionPropsList: string[];
} {
    let propsList = tail;
    let transitionType: EntranceTransitionType | undefined;
    let transitionPropsList: string[] = [];
    const withIndex = propsList.indexOf("with");
    if (withIndex !== -1 && propsList.length > withIndex + 1) {
        const rawType = propsList[withIndex + 1];
        if ((ENTRANCE_TRANSITION_TYPES as readonly string[]).includes(rawType)) {
            transitionType = rawType as EntranceTransitionType;
            transitionPropsList = propsList.slice(withIndex + 2);
        }
        propsList = propsList.slice(0, withIndex);
    }

    return { propsList, transitionType, transitionPropsList };
}

/**
 * Runs the shared `# show live2d` logic once `<alias>` and `<source>` have been resolved: parses
 * the tail into construction props and an optional entrance transition, constructs the
 * {@link Live2D} instance, and shows it (via the transition, or directly via `canvas.add`).
 */
async function runShowLive2D(
    alias: string,
    source: string,
    tail: string[],
    convertListStringToObj: (listParm: string[]) => object,
): Promise<true> {
    const { propsList, transitionType, transitionPropsList } = parseShowLive2DTail(tail);

    let props: Record<string, unknown> = {};
    if (propsList.length > 0) {
        try {
            props = convertListStringToObj(propsList) as Record<string, unknown>;
        } catch (e) {
            logger.error(`Failed to parse props for "show live2d ${alias}"`, e);
            return true;
        }
    }

    const live2d = new Live2D({
        ...(props as Partial<Live2DOptions>),
        source,
    });
    try {
        await live2d.ready;
    } catch {
        return true;
    }

    if (transitionType) {
        let transitionProps: object | undefined;
        if (transitionPropsList.length > 0) {
            try {
                transitionProps = convertListStringToObj(transitionPropsList);
            } catch (e) {
                logger.error(`Failed to parse transition props for "show live2d ${alias}"`, e);
            }
        }
        await executeEntranceTransition(alias, live2d, transitionType, transitionProps);
    } else {
        canvas.add(alias, live2d);
    }
    return true;
}

/**
 * Registers the `# show live2d` Ink hashtag command, letting Ink scripts show a {@link Live2D}
 * canvas element the same way `@drincs/pixi-vn-ink`'s built-in `# show image` shows an
 * `ImageSprite`: `<alias>` is just the canvas key (like every other `# show ...` command).
 * `<source>` (the model settings URL, or an asset alias) is an optional second positional token —
 * when omitted, `<alias>` itself is used as the source. Key/value construction props (forwarded to
 * {@link Live2DOptions}) and an optional entrance transition follow.
 *
 * Registered as two handlers (one per position of the free-form props, since `keySchemas` keys
 * refer to a fixed token index) that together behave as a single command with an optional
 * `<source>`.
 *
 * Call this once, near the start of your app (alongside e.g. `addBaseHashtagCommands`), before any
 * Ink content is parsed.
 *
 * @example
 * ```ink
 * # show live2d hero xAlign 0.5 yAlign 1 with dissolve duration 1
 * # show live2d hero hero-alt xAlign 0.5 yAlign 1 with dissolve duration 1
 * ```
 */
export function createLive2DHandler(): void {
    HashtagCommands.add(
        (list, _props, convertListStringToObj) => {
            const alias = list[2];
            return runShowLive2D(alias, alias, list.slice(3), convertListStringToObj);
        },
        {
            name: "Show live2d",
            description: `Shows a Live2D canvas element with key/value construction properties (forwarded to \`Live2DOptions\`) and an optional entrance transition. \`<alias>\` is the canvas key (like every other \`# show ...\` command); since no separate \`source\` prop is passed here, \`<alias>\` itself is used as the source (the model settings URL, or an asset alias) — e.g. "show live2d hero" loads the model from source "hero". If the canvas key and the source need to differ (e.g. showing the same model under two aliases), use "Show live2d with source" instead to pass an explicit, separate \`<source>\`.

\`\`\`ink
# show live2d <alias> [<key> <value> …] [with dissolve|fade|movein|moveout|zoomin|zoomout|pushin|pushout [<key> <value> …]]
\`\`\``,
            validation: z
                .tuple([z.literal("show"), z.literal("live2d"), z.string()])
                .rest(z.string())
                .refine((list) => isPropsOrWithToken(list[3])),
            keySchemas: {
                with: {},
                ...entranceTransitionKeySchemas,
                3: live2DOptionsSchema,
            },
        },
    );

    HashtagCommands.add(
        (list, _props, convertListStringToObj) => {
            const alias = list[2];
            const source = list[3];
            return runShowLive2D(alias, source, list.slice(4), convertListStringToObj);
        },
        {
            name: "Show live2d with source",
            description: `Shows a Live2D canvas element like "Show live2d", but with an explicit \`<source>\` (the model settings URL, or an asset alias) distinct from \`<alias>\` — use this when the canvas key shouldn't also be the source, e.g. to show the same model under two different aliases.

\`\`\`ink
# show live2d <alias> <source> [<key> <value> …] [with dissolve|fade|movein|moveout|zoomin|zoomout|pushin|pushout [<key> <value> …]]
\`\`\``,
            validation: z
                .tuple([z.literal("show"), z.literal("live2d"), z.string(), z.string()])
                .rest(z.string())
                .refine((list) => !isPropsOrWithToken(list[3])),
            keySchemas: {
                with: {},
                ...entranceTransitionKeySchemas,
                4: live2DOptionsSchema,
            },
        },
    );

    function runEditLive2D(
        alias: string,
        tail: string[],
        convertListStringToObj: (listParm: string[]) => object,
    ): boolean {
        const live2d = canvas.find<Live2D>(alias);
        if (!live2d) {
            logger.error(`"edit live2d ${alias}": no Live2D canvas element found with this alias`);
            return true;
        }
        if (tail.length === 0) {
            return true;
        }
        try {
            const props = convertListStringToObj(tail);
            Object.assign(live2d, props);
        } catch (e) {
            logger.error(`Failed to parse props for "edit live2d ${alias}"`, e);
        }
        return true;
    }

    HashtagCommands.add(
        (list, _props, convertListStringToObj) =>
            runEditLive2D(list[2], list.slice(3), convertListStringToObj),
        {
            name: "Edit live2d",
            description: `Edits the properties of a Live2D canvas element identified by its alias, using key/value properties (e.g. alpha, tint, x, y, visible, xAlign, ...).

\`\`\`ink
# edit live2d <alias> [<key> <value> …]
\`\`\``,
            validation: z
                .tuple([z.literal("edit"), z.literal("live2d"), z.string()])
                .rest(z.string()),
            keySchemas: {
                3: containerMemorySchema,
            },
        },
    );

    function runRemoveLive2D(
        alias: string,
        tail: string[],
        convertListStringToObj: (listParm: string[]) => object,
    ): boolean {
        const live2d = canvas.find<Live2D>(alias);
        if (!live2d) {
            logger.error(
                `"remove live2d ${alias}": no Live2D canvas element found with this alias`,
            );
            return true;
        }

        let transitionType: ExitTransitionType | undefined;
        let transitionPropsList: string[] = [];
        const withIndex = tail.indexOf("with");
        if (withIndex !== -1 && tail.length > withIndex + 1) {
            const rawType = tail[withIndex + 1];
            if ((EXIT_TRANSITION_TYPES as readonly string[]).includes(rawType)) {
                transitionType = rawType as ExitTransitionType;
                transitionPropsList = tail.slice(withIndex + 2);
            }
        }

        if (transitionType) {
            let transitionProps: object | undefined;
            if (transitionPropsList.length > 0) {
                try {
                    transitionProps = convertListStringToObj(transitionPropsList);
                } catch (e) {
                    logger.error(
                        `Failed to parse transition props for "remove live2d ${alias}"`,
                        e,
                    );
                }
            }
            executeExitTransition(alias, transitionType, transitionProps);
        } else {
            canvas.remove(alias);
        }
        return true;
    }

    HashtagCommands.add(
        (list, _props, convertListStringToObj) =>
            runRemoveLive2D(list[2], list.slice(3), convertListStringToObj),
        {
            name: "Remove live2d",
            description: `Removes a Live2D canvas element with an optional exit transition.

\`\`\`ink
# remove live2d <alias> [with dissolve|fade|movein|moveout|zoomin|zoomout|pushin|pushout [<key> <value> …]]
\`\`\``,
            validation: z
                .tuple([z.literal("remove"), z.literal("live2d"), z.string()])
                .rest(z.string()),
            keySchemas: {
                with: {},
                dissolve: entranceTransitionKeySchemas.dissolve,
                fade: entranceTransitionKeySchemas.fade,
                moveout: entranceTransitionKeySchemas.movein,
                zoomout: entranceTransitionKeySchemas.zoomin,
                pushout: entranceTransitionKeySchemas.pushin,
            },
        },
    );

    function findLive2DOrLogError(commandLabel: string, alias: string): Live2D | undefined {
        const live2d = canvas.find<Live2D>(alias);
        if (!live2d) {
            logger.error(`"${commandLabel}": no Live2D canvas element found with alias "${alias}"`);
        }
        return live2d;
    }

    HashtagCommands.add(
        async (list) => {
            const rawExpressionId = list[2];
            const alias = list[5];
            const live2d = findLive2DOrLogError(
                `change expression ${rawExpressionId} on live2d ${alias}`,
                alias,
            );
            if (!live2d) {
                return true;
            }
            const expressionId = /^-?\d+$/.test(rawExpressionId)
                ? Number(rawExpressionId)
                : rawExpressionId;
            await live2d.expression(expressionId);
            return true;
        },
        {
            name: "Change expression on live2d",
            description: `Sets the active expression on a Live2D canvas element identified by its alias. \`<expressionId>\` can be either the expression's name or its numeric index.

\`\`\`ink
# change expression <expressionId> on live2d <alias>
\`\`\``,
            validation: z.tuple([
                z.literal("change"),
                z.literal("expression"),
                z.string(),
                z.literal("on"),
                z.literal("live2d"),
                z.string(),
            ]),
        },
    );

    HashtagCommands.add(
        (list) => {
            const alias = list[4];
            const live2d = findLive2DOrLogError(`stop motions on live2d ${alias}`, alias);
            live2d?.stopMotions();
            return true;
        },
        {
            name: "Stop motions on live2d",
            description: `Stops every playing motion (and any lipsync audio) on a Live2D canvas element identified by its alias.

\`\`\`ink
# stop motions on live2d <alias>
\`\`\``,
            validation: z.tuple([
                z.literal("stop"),
                z.literal("motions"),
                z.literal("on"),
                z.literal("live2d"),
                z.string(),
            ]),
        },
    );

    HashtagCommands.add(
        async (list, _props, convertListStringToObj) => {
            const group = list[2];
            const alias = list[5];
            const live2d = findLive2DOrLogError(`play motion ${group} on live2d ${alias}`, alias);
            if (!live2d) {
                return true;
            }
            const tail = list.slice(6);
            let options: PlayMotionOptions = {};
            if (tail.length > 0) {
                try {
                    options = convertListStringToObj(tail) as PlayMotionOptions;
                } catch (e) {
                    logger.error(
                        `Failed to parse options for "play motion ${group} on live2d ${alias}"`,
                        e,
                    );
                    return true;
                }
            }
            const { index, priority, ...motionOptions } = options;
            await live2d.motion(group, index, priority, motionOptions);
            return true;
        },
        {
            name: "Play motion on live2d",
            description: `Starts a motion on a Live2D canvas element identified by its alias. Omit \`index\` to play a random motion from the group. Optional key/value properties: index, priority, sound, volume, expression, resetExpression.

\`\`\`ink
# play motion <group> on live2d <alias> [<key> <value> …]
# play motion Idle on live2d hero index 0 priority 3
\`\`\``,
            validation: z
                .tuple([
                    z.literal("play"),
                    z.literal("motion"),
                    z.string(),
                    z.literal("on"),
                    z.literal("live2d"),
                    z.string(),
                ])
                .rest(z.string()),
            keySchemas: {
                6: playMotionOptionsSchema,
            },
        },
    );
}
