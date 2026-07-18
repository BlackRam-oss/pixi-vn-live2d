import { createLive2DHandler, parseShowLive2DTail } from "@/ink";
import { logger } from "@/utils/log-utility";
import { canvas } from "@drincs/pixi-vn";
import { moveOut, pushOut, removeWithDissolve, removeWithFade, zoomOut } from "@drincs/pixi-vn/canvas";
import { HashtagCommands } from "@drincs/pixi-vn-ink";
import { executeEntranceTransition } from "@drincs/pixi-vn-json/actions";
import type { PixiVNJsonLabelStep } from "@drincs/pixi-vn-json/schema";
import { Live2D } from "@drincs/pixi-vn-live2d";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@drincs/pixi-vn-live2d", () => ({
    Live2D: vi.fn(function (this: Record<string, unknown>, options: Record<string, unknown>) {
        Object.assign(this, options);
        this.ready = Promise.resolve();
    }),
}));

vi.mock("@drincs/pixi-vn-json/actions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@drincs/pixi-vn-json/actions")>();
    return {
        ...actual,
        executeEntranceTransition: vi.fn(async () => ["ticker-id"]),
    };
});

vi.mock("@drincs/pixi-vn/canvas", () => ({
    removeWithDissolve: vi.fn(() => ["ticker-dissolve"]),
    removeWithFade: vi.fn(() => ["ticker-fade"]),
    moveOut: vi.fn(() => ["ticker-moveout"]),
    zoomOut: vi.fn(() => ["ticker-zoomout"]),
    pushOut: vi.fn(() => ["ticker-pushout"]),
}));

const step = {} as unknown as PixiVNJsonLabelStep;

afterEach(() => {
    HashtagCommands.clear();
    vi.restoreAllMocks();
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("parseShowLive2DTail", () => {
    test("no transition: the whole tail is props", () => {
        expect(parseShowLive2DTail(["source", "hero"])).toEqual({
            propsList: ["source", "hero"],
            transitionType: undefined,
            transitionPropsList: [],
        });
    });

    test("recognizes an entrance transition and its own props", () => {
        expect(
            parseShowLive2DTail(["source", "hero", "with", "dissolve", "duration", "1"]),
        ).toEqual({
            propsList: ["source", "hero"],
            transitionType: "dissolve",
            transitionPropsList: ["duration", "1"],
        });
    });

    test("drops the 'with' tail but ignores an unsupported (exit-only) transition type", () => {
        expect(
            parseShowLive2DTail(["source", "hero", "with", "moveout", "duration", "1"]),
        ).toEqual({
            propsList: ["source", "hero"],
            transitionType: undefined,
            transitionPropsList: [],
        });
    });
});

describe("createLive2DHandler", () => {
    test("registers 'Show live2d'", () => {
        createLive2DHandler();
        const names = HashtagCommands.info().map((o) => o.name);
        expect(names).toContain("Show live2d");
    });

    test("validation accepts an alias with a source prop", () => {
        createLive2DHandler();
        const opts = HashtagCommands.info().find((o) => o.name === "Show live2d");
        const validation = opts?.validation as { safeParse: (v: unknown) => { success: boolean } };
        expect(validation.safeParse(["show", "live2d", "hero", "source", "hero"]).success).toBe(
            true,
        );
    });

    test("registers a keySchemas section for the props position and each entrance transition", () => {
        createLive2DHandler();
        const opts = HashtagCommands.info().find((o) => o.name === "Show live2d");
        expect(Object.keys(opts?.keySchemas ?? {})).toEqual(
            expect.arrayContaining(["with", "dissolve", "fade", "movein", "zoomin", "pushin", "3"]),
        );
        const propsSchema = (opts?.keySchemas as Record<string, { required?: string[] }>)?.[3];
        expect(propsSchema?.required).toContain("source");
    });
});

describe("createLive2DHandler: running '# show live2d' through HashtagCommands.run", () => {
    beforeEach(() => {
        createLive2DHandler();
        vi.spyOn(canvas, "add").mockImplementation(() => undefined as never);
    });

    test("alias is just the canvas key; source comes from props, no transition -> canvas.add", async () => {
        await HashtagCommands.run("show live2d hero source hero", step, {} as never);

        expect(Live2D).toHaveBeenCalledWith({ source: "hero" });

        expect(canvas.add).toHaveBeenCalledTimes(1);
        const [aliasArg, live2dArg] = vi.mocked(canvas.add).mock.calls[0];
        expect(aliasArg).toBe("hero");
        expect(live2dArg).toMatchObject({ source: "hero" });
        expect(executeEntranceTransition).not.toHaveBeenCalled();
    });

    test("forwards extra key/value props to the Live2D constructor", async () => {
        await HashtagCommands.run(
            "show live2d hero source hero xAlign 0.5 yAlign 1",
            step,
            {} as never,
        );

        expect(Live2D).toHaveBeenCalledWith({
            source: "hero",
            xAlign: 0.5,
            yAlign: 1,
        });
    });

    test("with a supported entrance transition: executeEntranceTransition runs instead of canvas.add", async () => {
        await HashtagCommands.run(
            "show live2d hero source hero with dissolve duration 1",
            step,
            {} as never,
        );

        expect(executeEntranceTransition).toHaveBeenCalledTimes(1);
        const [alias, live2dArg, type, transitionProps] = vi.mocked(executeEntranceTransition)
            .mock.calls[0];
        expect(alias).toBe("hero");
        expect(live2dArg).toMatchObject({ source: "hero" });
        expect(type).toBe("dissolve");
        expect(transitionProps).toEqual({ duration: 1 });
        expect(canvas.add).not.toHaveBeenCalled();
    });

    test("an unsupported (exit-only) transition type falls back to a plain canvas.add", async () => {
        await HashtagCommands.run(
            "show live2d hero source hero with moveout duration 1",
            step,
            {} as never,
        );

        expect(executeEntranceTransition).not.toHaveBeenCalled();
        expect(canvas.add).toHaveBeenCalledTimes(1);
    });

    test("missing source prop: logs an error and never constructs a Live2D", async () => {
        const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

        await HashtagCommands.run("show live2d hero xAlign 0.5", step, {} as never);

        expect(errorSpy).toHaveBeenCalled();
        expect(Live2D).not.toHaveBeenCalled();
        expect(canvas.add).not.toHaveBeenCalled();
    });

    test("a malformed command (missing alias) is left unhandled", async () => {
        const result = await HashtagCommands.run("show live2d", step, {} as never);

        expect(result).toBeUndefined();
        expect(Live2D).not.toHaveBeenCalled();
    });
});

describe("createLive2DHandler: 'Edit live2d'", () => {
    test("registers 'Edit live2d' with a keySchemas section for the props position", () => {
        createLive2DHandler();
        const opts = HashtagCommands.info().find((o) => o.name === "Edit live2d");
        expect(opts).toBeDefined();
        expect((opts?.keySchemas as Record<string, unknown> | undefined)?.[3]).toBeDefined();
    });

    describe("running '# edit live2d' through HashtagCommands.run", () => {
        let fakeLive2D: Record<string, unknown>;

        beforeEach(() => {
            createLive2DHandler();
            fakeLive2D = { alpha: 1, x: 0 };
            vi.spyOn(canvas, "find").mockImplementation(() => fakeLive2D as never);
        });

        test("applies key/value props onto the found canvas element", async () => {
            await HashtagCommands.run("edit live2d hero alpha 0.5 x 100", step, {} as never);

            expect(canvas.find).toHaveBeenCalledWith("hero");
            expect(fakeLive2D).toMatchObject({ alpha: 0.5, x: 100 });
        });

        test("no props: leaves the element untouched", async () => {
            await HashtagCommands.run("edit live2d hero", step, {} as never);

            expect(fakeLive2D).toEqual({ alpha: 1, x: 0 });
        });

        test("alias not found: logs an error instead of throwing", async () => {
            vi.mocked(canvas.find).mockReturnValue(undefined);
            const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

            await expect(
                HashtagCommands.run("edit live2d missing alpha 0.5", step, {} as never),
            ).resolves.toBeUndefined();

            expect(errorSpy).toHaveBeenCalled();
        });
    });
});

describe("createLive2DHandler: 'Remove live2d'", () => {
    test("registers 'Remove live2d' with keySchemas for 'with' and each exit transition", () => {
        createLive2DHandler();
        const opts = HashtagCommands.info().find((o) => o.name === "Remove live2d");
        expect(Object.keys(opts?.keySchemas ?? {})).toEqual(
            expect.arrayContaining(["with", "dissolve", "fade", "moveout", "zoomout", "pushout"]),
        );
    });

    describe("running '# remove live2d' through HashtagCommands.run", () => {
        let fakeLive2D: Record<string, unknown>;

        beforeEach(() => {
            createLive2DHandler();
            fakeLive2D = {};
            vi.spyOn(canvas, "find").mockImplementation(() => fakeLive2D as never);
            vi.spyOn(canvas, "remove").mockImplementation(() => undefined as never);
        });

        test("no transition: canvas.remove is called with the alias", async () => {
            await HashtagCommands.run("remove live2d hero", step, {} as never);

            expect(canvas.remove).toHaveBeenCalledWith("hero");
            expect(removeWithDissolve).not.toHaveBeenCalled();
        });

        test("with 'dissolve': removeWithDissolve runs instead of canvas.remove", async () => {
            await HashtagCommands.run(
                "remove live2d hero with dissolve duration 1",
                step,
                {} as never,
            );

            expect(removeWithDissolve).toHaveBeenCalledWith("hero", { duration: 1 });
            expect(canvas.remove).not.toHaveBeenCalled();
        });

        test.each([
            ["moveout", () => moveOut],
            ["zoomout", () => zoomOut],
            ["pushout", () => pushOut],
        ] as const)("with '%s': the matching exit transition runs", async (type, getFn) => {
            await HashtagCommands.run(
                `remove live2d hero with ${type} duration 1`,
                step,
                {} as never,
            );

            expect(getFn()).toHaveBeenCalledWith("hero", { duration: 1 });
            expect(canvas.remove).not.toHaveBeenCalled();
        });

        test("with an unsupported (entrance-only) transition type: falls back to canvas.remove", async () => {
            await HashtagCommands.run(
                "remove live2d hero with movein duration 1",
                step,
                {} as never,
            );

            expect(canvas.remove).toHaveBeenCalledWith("hero");
            expect(removeWithDissolve).not.toHaveBeenCalled();
            expect(moveOut).not.toHaveBeenCalled();
        });

        test("alias not found: logs an error and never calls canvas.remove", async () => {
            vi.mocked(canvas.find).mockReturnValue(undefined);
            const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

            await HashtagCommands.run("remove live2d missing", step, {} as never);

            expect(errorSpy).toHaveBeenCalled();
            expect(canvas.remove).not.toHaveBeenCalled();
        });
    });
});

function createFakeLive2D() {
    return {
        expression: vi.fn(async () => true),
        stopMotions: vi.fn(),
        motion: vi.fn(async () => true),
    };
}

describe("createLive2DHandler: 'Change expression on live2d'", () => {
    let fakeLive2D: ReturnType<typeof createFakeLive2D>;

    beforeEach(() => {
        createLive2DHandler();
        fakeLive2D = createFakeLive2D();
        vi.spyOn(canvas, "find").mockImplementation(() => fakeLive2D as never);
    });

    test("registers 'Change expression on live2d'", () => {
        const names = HashtagCommands.info().map((o) => o.name);
        expect(names).toContain("Change expression on live2d");
    });

    test("calls live2d.expression with a number when the id is numeric", async () => {
        await HashtagCommands.run("change expression 2 on live2d hero", step, {} as never);

        expect(canvas.find).toHaveBeenCalledWith("hero");
        expect(fakeLive2D.expression).toHaveBeenCalledWith(2);
    });

    test("calls live2d.expression with the name when the id isn't numeric", async () => {
        await HashtagCommands.run("change expression Smile on live2d hero", step, {} as never);

        expect(fakeLive2D.expression).toHaveBeenCalledWith("Smile");
    });

    test("alias not found: logs an error instead of throwing", async () => {
        vi.mocked(canvas.find).mockReturnValue(undefined);
        const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

        await expect(
            HashtagCommands.run("change expression Smile on live2d missing", step, {} as never),
        ).resolves.toBeUndefined();

        expect(errorSpy).toHaveBeenCalled();
    });
});

describe("createLive2DHandler: 'Stop motions on live2d'", () => {
    let fakeLive2D: ReturnType<typeof createFakeLive2D>;

    beforeEach(() => {
        createLive2DHandler();
        fakeLive2D = createFakeLive2D();
        vi.spyOn(canvas, "find").mockImplementation(() => fakeLive2D as never);
    });

    test("registers 'Stop motions on live2d'", () => {
        const names = HashtagCommands.info().map((o) => o.name);
        expect(names).toContain("Stop motions on live2d");
    });

    test("calls live2d.stopMotions", async () => {
        await HashtagCommands.run("stop motions on live2d hero", step, {} as never);

        expect(fakeLive2D.stopMotions).toHaveBeenCalled();
    });

    test("alias not found: logs an error instead of throwing", async () => {
        vi.mocked(canvas.find).mockReturnValue(undefined);
        const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

        await HashtagCommands.run("stop motions on live2d missing", step, {} as never);

        expect(errorSpy).toHaveBeenCalled();
        expect(fakeLive2D.stopMotions).not.toHaveBeenCalled();
    });
});

describe("createLive2DHandler: 'Play motion on live2d'", () => {
    let fakeLive2D: ReturnType<typeof createFakeLive2D>;

    beforeEach(() => {
        createLive2DHandler();
        fakeLive2D = createFakeLive2D();
        vi.spyOn(canvas, "find").mockImplementation(() => fakeLive2D as never);
    });

    test("registers 'Play motion on live2d' with a keySchemas section for the options position", () => {
        const opts = HashtagCommands.info().find((o) => o.name === "Play motion on live2d");
        expect((opts?.keySchemas as Record<string, unknown> | undefined)?.[6]).toBeDefined();
    });

    test("calls live2d.motion with undefined index/priority when none are given", async () => {
        await HashtagCommands.run("play motion Idle on live2d hero", step, {} as never);

        expect(fakeLive2D.motion).toHaveBeenCalledWith("Idle", undefined, undefined, {});
    });

    test("forwards key/value options to live2d.motion, splitting out index/priority", async () => {
        await HashtagCommands.run(
            "play motion Idle on live2d hero index 2 priority 3 volume 0.8",
            step,
            {} as never,
        );

        expect(fakeLive2D.motion).toHaveBeenCalledWith("Idle", 2, 3, { volume: 0.8 });
    });

    test("alias not found: logs an error instead of throwing", async () => {
        vi.mocked(canvas.find).mockReturnValue(undefined);
        const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

        await HashtagCommands.run("play motion Idle on live2d missing", step, {} as never);

        expect(errorSpy).toHaveBeenCalled();
        expect(fakeLive2D.motion).not.toHaveBeenCalled();
    });
});
