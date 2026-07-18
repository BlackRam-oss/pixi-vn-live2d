import type Live2D from "@/components/Live2D";
import { CanvasPropertyUtility as PropsUtils } from "@drincs/pixi-vn";

/**
 * Unlike native PIXI containers/sprites (where `anchor`, when present, is independent of
 * `pivot`), `untitled-pixi-live2d-engine`'s `Live2DModel` bakes `anchor` directly into `pivot`
 * (in the model's own unscaled units — `pivot = anchor * internalModel.width/height` — applied
 * by its own `onAnchorChange`). Pixi'VN's align/percentagePosition math already re-applies
 * `anchor` as its own (correctly scaled) term, so the anchor-driven portion of `pivot` is
 * subtracted back out here first; otherwise it gets counted twice and the element ends up
 * further off than `align` alone would put it.
 */
export function getSuperPivot(live2d: Live2D) {
    const internalWidth = live2d.internalModel?.width ?? 0;
    const internalHeight = live2d.internalModel?.height ?? 0;
    const rawPivot = {
        x: live2d.pivot.x - live2d.anchor.x * internalWidth,
        y: live2d.pivot.y - live2d.anchor.y * internalHeight,
    };
    return PropsUtils.getSuperPoint(rawPivot, live2d.angle);
}
