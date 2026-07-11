import type { Live2DMemory, Live2DOptions, MotionMemory } from "@/interfaces";
import { logger } from "@/utils/log-utility";
import { getSuperPivot } from "@/utils/props-utility";
import {
    addListenerHandler,
    analizePositionsExtensionProps,
    CanvasPropertyUtility as PropsUtils,
    RegisteredCanvasComponents,
    setMemoryContainer,
    type AdditionalPositionsExtension,
    type CanvasBaseItem,
    type ListenerExtension,
    type OnEventsHandlers,
} from "@drincs/pixi-vn";
import {
    Live2DModel as CoreLive2DModel,
    Live2DFactory,
    type Live2DFactoryOptions,
} from "@drincs/pixi-vn-live2d/core";
import type {
    ContainerChild,
    ContainerEvents,
    EventEmitter,
    ObservablePoint,
    PointData,
} from "pixi.js";

const CANVAS_LIVE2D_ID = "Live2D";

/**
 * Live2D component for Pixi.js, used to display Live2D components.
 * @example
 * ```ts
 * import { canvas } from "@drincs/pixi-vn";
 * import { Live2D } from "@drincs/pixi-vn-live2d";
 *
 * const live2d = new Live2D({ source: "https://example.com/model/model3.json" });
 * await live2d.ready;
 * live2d.anchor.set(0.5);
 * live2d.x = canvas.width / 2;
 * live2d.y = canvas.height;
 *
 * live2d.motion("Idle");
 *
 * canvas.add("live2d", live2d);
 * ```
 */
export default class Live2D
    extends CoreLive2DModel
    implements CanvasBaseItem<Live2DMemory>, ListenerExtension, AdditionalPositionsExtension
{
    constructor(options: Live2DOptions) {
        const {
            source,
            checkMocConsistency,
            crossOrigin,
            onLoad,
            onError,
            motionPreload,
            idleMotionGroup,
            checkMotionConsistency,
            breathDepth,
            lipSyncGain,
            lipSyncWeight,
            useHighPrecisionMask,
            autoUpdate,
            autoHitTest,
            autoFocus,
            autoInteract,
            ticker,
            textureOptions,
            ...containerOptions
        } = options;
        const { anchor, align, percentagePosition, ...restOptions } =
            analizePositionsExtensionProps(containerOptions) || {};
        const setupOptions: Live2DFactoryOptions = {
            checkMocConsistency,
            crossOrigin,
            onLoad,
            onError,
            motionPreload,
            idleMotionGroup,
            checkMotionConsistency,
            breathDepth,
            lipSyncGain,
            lipSyncWeight,
            useHighPrecisionMask,
            autoUpdate,
            autoHitTest,
            autoFocus,
            autoInteract,
            ticker,
            textureOptions,
        };
        super(setupOptions);
        this.sourceAlias = source;
        this.configOptions = setupOptions;
        setMemoryContainer(this, restOptions);
        if (anchor !== undefined) {
            if (typeof anchor === "number") {
                this.anchor.set(anchor, anchor);
            } else {
                this.anchor.set(anchor.x ?? this.anchor.x, anchor.y ?? this.anchor.y);
            }
        }
        if (align) {
            this.align = align;
        }
        if (percentagePosition) {
            this.percentagePosition = percentagePosition;
        }
        this._ready = Live2DFactory.setupLive2DModel(this, source, setupOptions).catch((e) => {
            logger.error(`Failed to load the Live2D model from "${this.sourceAlias}"`, e);
            throw e;
        });
    }
    readonly pixivnId: string = CANVAS_LIVE2D_ID;
    /**
     * The model source used to load this instance.
     */
    readonly sourceAlias: string;
    private readonly configOptions: Live2DFactoryOptions;
    private readonly _ready: Promise<void>;
    /**
     * Promise that resolves once the model resources have been loaded and it's safe to be manipulated/rendered.
     */
    get ready(): Promise<void> {
        return this._ready;
    }
    private _currentExpressionId?: number | string;
    /**
     * Creates a Live2D instance and waits until its resources have been loaded.
     * @param options The options for the component.
     */
    static async create(options: Live2DOptions): Promise<Live2D> {
        const instance = new Live2D(options);
        await instance.ready;
        return instance;
    }
    override async expression(id?: number | string): Promise<boolean> {
        const result = await super.expression(id);
        if (result) {
            this._currentExpressionId = id;
        }
        return result;
    }
    get memory(): Live2DMemory {
        const { onLoad, onError, ticker, ...serializableOptions } = this.configOptions;
        const motionManagerState = this.internalModel?.motionManager?.state;
        const parallelMotionManagers = this.internalModel?.parallelMotionManager ?? [];
        return {
            pixivnId: CANVAS_LIVE2D_ID,
            source: this.sourceAlias,
            ...serializableOptions,
            // container properties
            isRenderGroup: this.isRenderGroup,
            blendMode: this.blendMode,
            tint: this.tint,
            alpha: this.alpha,
            angle: this.angle,
            renderable: this.renderable,
            rotation: this.rotation,
            scale: {
                x: this.scale.x,
                y: this.scale.y,
            },
            pivot: {
                x: this.pivot.x,
                y: this.pivot.y,
            },
            position: {
                x: this.position.x,
                y: this.position.y,
            },
            skew: {
                x: this.skew.x,
                y: this.skew.y,
            },
            visible: this.visible,
            x: this.x,
            y: this.y,
            cursor: this.cursor,
            eventMode: this.eventMode,
            interactive: this.interactive,
            interactiveChildren: this.interactiveChildren,
            height: this.height,
            width: this.width,
            label: this.label,
            zIndex: this.zIndex,
            sortableChildren: this.sortableChildren,
            sortDirty: this.sortDirty,
            tabIndex: this.tabIndex,
            accessible: this.accessible,
            accessibleChildren: this.accessibleChildren,
            accessibleHint: this.accessibleHint,
            accessiblePointerEvents: this.accessiblePointerEvents,
            accessibleText: this.accessibleText,
            accessibleTitle: this.accessibleTitle,
            accessibleType: this.accessibleType,
            cullable: this.cullable,
            cullableChildren: this.cullableChildren,
            // additional positions and anchor
            anchor: { x: this.anchor.x, y: this.anchor.y },
            align: this._align,
            percentagePosition: this._percentagePosition,
            // Live2D properties
            focus: this.internalModel
                ? {
                      x: this.internalModel.focusController.targetX,
                      y: this.internalModel.focusController.targetY,
                  }
                : undefined,
            currentExpressionId: this._currentExpressionId,
            currentMotion:
                motionManagerState?.currentGroup !== undefined
                    ? {
                          group: motionManagerState.currentGroup,
                          index: motionManagerState.currentIndex ?? 0,
                          priority: motionManagerState.currentPriority,
                      }
                    : undefined,
            parallelMotions: parallelMotionManagers.map((manager) => {
                const state = manager.state;
                if (state.currentGroup === undefined) {
                    return null;
                }
                const res: MotionMemory = {
                    group: state.currentGroup,
                    index: state.currentIndex ?? 0,
                    priority: state.currentPriority,
                };
                return res;
            }),
        };
    }
    async setMemory(memory: Live2DMemory): Promise<void> {
        await setMemoryContainer(this, memory, {
            end: () => {
                if (memory.label !== undefined) this.label = memory.label;
                if (memory.zIndex !== undefined) this.zIndex = memory.zIndex;
                if (memory.sortableChildren !== undefined)
                    this.sortableChildren = memory.sortableChildren;
                if (memory.sortDirty !== undefined) this.sortDirty = memory.sortDirty;
                if (memory.tabIndex !== undefined) this.tabIndex = memory.tabIndex;
                if (memory.accessible !== undefined) this.accessible = memory.accessible;
                if (memory.accessibleChildren !== undefined)
                    this.accessibleChildren = memory.accessibleChildren;
                if (memory.accessibleHint !== undefined)
                    this.accessibleHint = memory.accessibleHint;
                if (memory.accessiblePointerEvents !== undefined)
                    this.accessiblePointerEvents = memory.accessiblePointerEvents;
                if (memory.accessibleText !== undefined)
                    this.accessibleText = memory.accessibleText;
                if (memory.accessibleTitle !== undefined)
                    this.accessibleTitle = memory.accessibleTitle;
                if (memory.accessibleType !== undefined)
                    this.accessibleType = memory.accessibleType;
                if (memory.cullable !== undefined) this.cullable = memory.cullable;
                if (memory.cullableChildren !== undefined)
                    this.cullableChildren = memory.cullableChildren;
                if (memory.anchor !== undefined) this.anchor.set(memory.anchor.x, memory.anchor.y);
                if ("align" in memory && memory.align !== undefined)
                    this.align = memory.align as Partial<PointData>;
                if ("percentagePosition" in memory && memory.percentagePosition !== undefined)
                    this.percentagePosition = memory.percentagePosition as Partial<PointData>;
            },
        });
        if (memory.focus) {
            this.focus(memory.focus.x, memory.focus.y, true);
        }
        if (memory.currentExpressionId !== undefined) {
            await this.expression(memory.currentExpressionId);
        }
        if (memory.currentMotion) {
            await this.motion(
                memory.currentMotion.group,
                memory.currentMotion.index,
                memory.currentMotion.priority,
            );
        }
        const parallelMotions = memory.parallelMotions?.filter((m): m is MotionMemory => !!m) ?? [];
        if (parallelMotions.length) {
            await this.parallelMotion(parallelMotions);
        }
    }

    /** ListenerExtension */
    readonly onEventsHandlers: OnEventsHandlers = {};
    override on<
        T extends
            | keyof ContainerEvents<ContainerChild>
            | keyof { [K: symbol]: any; [K: {} & string]: any },
    >(
        event: T,
        fn: (
            ...args: [
                ...EventEmitter.ArgumentMap<
                    ContainerEvents<ContainerChild> & { [K: symbol]: any; [K: {} & string]: any }
                >[Extract<
                    T,
                    | keyof ContainerEvents<ContainerChild>
                    | keyof { [K: symbol]: any; [K: {} & string]: any }
                >],
                typeof this,
            ]
        ) => void,
        context?: any,
    ): this {
        addListenerHandler(event, this, fn);

        return super.on<T>(event, (...e) => fn.apply(context, [...e, this]), context);
    }

    /** AdditionalPositions */
    private _align: Partial<PointData> | undefined = undefined;
    set align(value: Partial<PointData> | number) {
        this._percentagePosition = undefined;
        if (this._align === undefined) this._align = {};
        if (typeof value === "number") {
            this._align.x = value;
            this._align.y = value;
        } else {
            if (value.x !== undefined) this._align.x = value.x;
            if (value.y !== undefined) this._align.y = value.y;
        }
        this.reloadPosition();
    }
    get align() {
        const superPivot = getSuperPivot(this);
        const superScale = PropsUtils.getSuperPoint(this.scale, this.angle);
        return {
            x: PropsUtils.calculateAlignByPosition(
                "width",
                this.x,
                PropsUtils.getSuperWidth(this),
                superPivot.x,
                superScale.x < 0,
                this.anchor.x,
            ),
            y: PropsUtils.calculateAlignByPosition(
                "height",
                this.y,
                PropsUtils.getSuperHeight(this),
                superPivot.y,
                superScale.y < 0,
                this.anchor.y,
            ),
        };
    }
    set xAlign(value: number) {
        if (this._percentagePosition) {
            this._percentagePosition = undefined;
        }
        if (this._align === undefined) this._align = {};
        this._align.x = value;
        this.reloadPosition();
    }
    get xAlign() {
        const superPivot = getSuperPivot(this);
        const superScale = PropsUtils.getSuperPoint(this.scale, this.angle);
        return PropsUtils.calculateAlignByPosition(
            "width",
            this.x,
            PropsUtils.getSuperWidth(this),
            superPivot.x,
            superScale.x < 0,
            this.anchor.x,
        );
    }
    set yAlign(value: number) {
        if (this._percentagePosition) {
            this._percentagePosition = undefined;
        }
        if (this._align === undefined) this._align = {};
        this._align.y = value;
        this.reloadPosition();
    }
    get yAlign() {
        const superPivot = getSuperPivot(this);
        const superScale = PropsUtils.getSuperPoint(this.scale, this.angle);
        return PropsUtils.calculateAlignByPosition(
            "height",
            this.y,
            PropsUtils.getSuperHeight(this),
            superPivot.y,
            superScale.y < 0,
            this.anchor.y,
        );
    }
    private _percentagePosition: Partial<PointData> | undefined = undefined;
    set percentagePosition(value: Partial<PointData> | number) {
        this._align = undefined;
        if (this._percentagePosition === undefined) this._percentagePosition = {};
        if (typeof value === "number") {
            this._percentagePosition.x = value;
            this._percentagePosition.y = value;
        } else {
            if (value.x !== undefined) this._percentagePosition.x = value.x;
            if (value.y !== undefined) this._percentagePosition.y = value.y;
        }
        this.reloadPosition();
    }
    get percentagePosition() {
        return {
            x: PropsUtils.calculatePercentagePositionByPosition("width", this.x),
            y: PropsUtils.calculatePercentagePositionByPosition("height", this.y),
        };
    }
    set percentageX(_value: number) {
        if (this._align) {
            this._align = undefined;
        }
        if (this._percentagePosition === undefined) this._percentagePosition = {};
        this._percentagePosition.x = _value;
        this.reloadPosition();
    }
    get percentageX() {
        return PropsUtils.calculatePercentagePositionByPosition("width", this.x);
    }
    set percentageY(_value: number) {
        if (this._align) {
            this._align = undefined;
        }
        if (this._percentagePosition === undefined) this._percentagePosition = {};
        this._percentagePosition.y = _value;
        this.reloadPosition();
    }
    get percentageY() {
        return PropsUtils.calculatePercentagePositionByPosition("height", this.y);
    }
    get positionType(): "pixel" | "percentage" | "align" {
        if (this._align) {
            return "align";
        } else if (this._percentagePosition) {
            return "percentage";
        }
        return "pixel";
    }
    get positionInfo(): { x: number; y: number; type: "pixel" | "percentage" | "align" } {
        if (this._align) {
            return { x: this._align.x || 0, y: this._align.y || 0, type: "align" };
        } else if (this._percentagePosition) {
            return {
                x: this._percentagePosition.x || 0,
                y: this._percentagePosition.y || 0,
                type: "percentage",
            };
        }
        return { x: this.x, y: this.y, type: "pixel" };
    }
    set positionInfo(value: { x: number; y: number; type?: "pixel" | "percentage" | "align" }) {
        if (value.type === "align") {
            this.align = { x: value.x, y: value.y };
        } else if (value.type === "percentage") {
            this.percentagePosition = { x: value.x, y: value.y };
        } else {
            this.position.set(value.x, value.y);
        }
    }
    protected reloadPosition() {
        if (this._align) {
            const superPivot = getSuperPivot(this);
            const superScale = PropsUtils.getSuperPoint(this.scale, this.angle);
            if (this._align.x !== undefined) {
                super.x = PropsUtils.calculatePositionByAlign(
                    "width",
                    this._align.x,
                    PropsUtils.getSuperWidth(this),
                    superPivot.x,
                    superScale.x < 0,
                );
            }
            if (this._align.y !== undefined) {
                super.y = PropsUtils.calculatePositionByAlign(
                    "height",
                    this._align.y,
                    PropsUtils.getSuperHeight(this),
                    superPivot.y,
                    superScale.y < 0,
                );
            }
        } else if (this._percentagePosition) {
            if (this._percentagePosition.x !== undefined) {
                super.x = PropsUtils.calculatePositionByPercentagePosition(
                    "width",
                    this._percentagePosition.x,
                );
            }
            if (this._percentagePosition.y !== undefined) {
                super.y = PropsUtils.calculatePositionByPercentagePosition(
                    "height",
                    this._percentagePosition.y,
                );
            }
        }
    }
    get position(): ObservablePoint {
        return super.position;
    }
    set position(value: ObservablePoint) {
        this._align = undefined;
        this._percentagePosition = undefined;
        super.position = value;
    }
    get x(): number {
        return super.x;
    }
    set x(value: number) {
        this._align = undefined;
        this._percentagePosition = undefined;
        super.x = value;
    }
    override get y(): number {
        return super.y;
    }
    override set y(value: number) {
        this._align = undefined;
        this._percentagePosition = undefined;
        super.y = value;
    }
}
RegisteredCanvasComponents.add<Live2DMemory, typeof Live2D>(Live2D, {
    name: CANVAS_LIVE2D_ID,
    getInstance: async (canvasClass, memory) => {
        const instance = new canvasClass({
            source: memory.source,
            motionPreload: memory.motionPreload,
            idleMotionGroup: memory.idleMotionGroup,
            checkMotionConsistency: memory.checkMotionConsistency,
            checkMocConsistency: memory.checkMocConsistency,
            crossOrigin: memory.crossOrigin,
            breathDepth: memory.breathDepth,
            lipSyncGain: memory.lipSyncGain,
            lipSyncWeight: memory.lipSyncWeight,
            useHighPrecisionMask: memory.useHighPrecisionMask,
            textureOptions: memory.textureOptions,
            autoUpdate: memory.autoUpdate,
            autoHitTest: memory.autoHitTest,
            autoFocus: memory.autoFocus,
            autoInteract: memory.autoInteract,
        });
        await instance.ready;
        await instance.setMemory(memory);
        return instance;
    },
});
