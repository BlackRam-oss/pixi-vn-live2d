import { afterEach, describe, expect, it, vi } from "vitest";

const setupLive2DModelMock = vi.fn(async () => {});

// untitled-pixi-live2d-engine expects a real browser (Cubism runtimes loaded via
// <script> tags, Web Audio API, WebGL) to even be imported. Since these tests only
// exercise Live2D's own logic (option forwarding, event context binding), stand in
// with a minimal PIXI.Container-based fake instead of loading the real engine.
vi.mock("@drincs/pixi-vn-live2d/core", async () => {
    const { Container } = await import("@drincs/pixi-vn/pixi.js");
    class FakeCoreLive2DModel extends Container {
        anchor = { x: 0, y: 0, set: vi.fn() };
        constructor(_options?: unknown) {
            super();
        }
    }
    return {
        Live2DModel: FakeCoreLive2DModel,
        Live2DFactory: { setupLive2DModel: setupLive2DModelMock },
    };
});

const { default: Live2D } = await import("@/components/Live2D");

describe("Live2D options forwarding", () => {
    afterEach(() => {
        setupLive2DModelMock.mockClear();
    });

    it("omits options the caller did not specify, instead of forwarding them as undefined", () => {
        new Live2D({ source: "model.json" });

        expect(setupLive2DModelMock).toHaveBeenCalledTimes(1);
        const setupOptions = setupLive2DModelMock.mock.calls[0][2];

        for (const [key, value] of Object.entries(setupOptions)) {
            expect(value, `expected option "${key}" to be omitted, not forwarded as undefined`).not.toBeUndefined();
        }
    });

    it("still forwards options the caller explicitly sets, including falsy ones", () => {
        new Live2D({ source: "model.json", breathDepth: 2, autoFocus: false });

        const setupOptions = setupLive2DModelMock.mock.calls[0][2];
        expect(setupOptions.breathDepth).toBe(2);
        expect(setupOptions.autoFocus).toBe(false);
    });
});

describe("Live2D on() event forwarding", () => {
    afterEach(() => {
        setupLive2DModelMock.mockClear();
    });

    it("preserves the caller-provided `this` context when invoking the handler", () => {
        const live2d = new Live2D({ source: "model.json" });
        const context = { name: "engine-internal-context" };
        let receivedThis: unknown;

        live2d.on(
            "pointertap",
            function (this: unknown) {
                receivedThis = this;
            },
            context,
        );
        live2d.emit("pointertap", {} as never);

        expect(receivedThis).toBe(context);
    });

    it("still appends the component instance as the last argument for user handlers", () => {
        const live2d = new Live2D({ source: "model.json" });
        let receivedArgs: unknown[] = [];

        live2d.on("pointertap", (...args) => {
            receivedArgs = args;
        });
        const event = { type: "pointertap" };
        live2d.emit("pointertap", event as never);

        expect(receivedArgs[0]).toBe(event);
        expect(receivedArgs[receivedArgs.length - 1]).toBe(live2d);
    });
});
