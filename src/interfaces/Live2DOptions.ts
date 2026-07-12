import type { ContainerOptions } from "@drincs/pixi-vn";
import type { Live2DFactoryOptions } from "@drincs/pixi-vn-live2d/core";

export default interface Live2DOptions extends Live2DFactoryOptions, ContainerOptions {
    /**
     * The model settings file URL (e.g. `model.model3.json` or `model.model.json`), or an
     * alias registered with Pixi's `Assets` (e.g. via `Assets.add({ alias, src })`). If
     * `source` matches a registered alias, it is resolved through `Assets`; otherwise it's
     * treated as a direct URL.
     */
    source: string;
}
