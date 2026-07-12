import { canvas, newLabel } from "@drincs/pixi-vn";
import { Live2D } from "@drincs/pixi-vn-live2d";

export const baseLabel = newLabel("base", [
    async () => {
        const live2d = await Live2D.create({
            source:
                "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json",
        });
        live2d.anchor.set(0.5, 1);
        live2d.scale.set((canvas.height * 0.9) / live2d.height);
        live2d.position.set(canvas.width / 2, canvas.height);
        canvas.add("live2d", live2d);
    },
    ()=>{}
]);

export const motionLabel = newLabel("motion", [
    async () => {
        const live2d = await Live2D.create({
            source:
                "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json",
        });
        live2d.anchor.set(0.5, 1);
        live2d.scale.set((canvas.height * 0.9) / live2d.height);
        live2d.position.set(canvas.width / 2, canvas.height);
        canvas.add("live2d", live2d);
        live2d.motion("Idle", 0);
        canvas.animate(
            live2d,
            [
                [{ x: canvas.width * 0.7 }, { duration: 2, ease: "linear" }],
                [{ x: canvas.width * 0.3 }, { duration: 2, ease: "linear" }],
            ],
            { repeat: Infinity },
        );
    },
    ()=>{}
]);

export const expressionLabel = newLabel("expression", [
    async () => {
        const live2d = await Live2D.create({
            source: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples/Samples/Resources/Mao/Mao.model3.json",
        });
        live2d.anchor.set(0.5, 1);
        live2d.scale.set((canvas.height * 0.9) / live2d.height);
        live2d.position.set(canvas.width / 2, canvas.height);
        canvas.add("live2d", live2d);
        live2d.motion("Idle", 0);
        await live2d.expression("exp_03");
    },
    ()=>{}
]);
