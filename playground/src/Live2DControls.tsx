import { Live2D } from "@drincs/pixi-vn-live2d";

interface ExpressionInfo {
  id: number;
  name: string;
}

function getExpressions(live2d: Live2D): ExpressionInfo[] {
  const definitions =
    live2d.internalModel?.motionManager?.expressionManager?.definitions ?? [];
  return definitions.map((definition, id) => ({
    id,
    name:
      (definition as { Name?: string; name?: string } | null | undefined)
        ?.Name ??
      (definition as { Name?: string; name?: string } | null | undefined)
        ?.name ??
      `#${id}`,
  }));
}

function getMotionGroups(live2d: Live2D): [string, number][] {
  const definitions = live2d.internalModel?.motionManager?.definitions ?? {};
  return Object.entries(definitions).map(([group, list]) => [
    group,
    list?.length ?? 0,
  ]);
}

export default function Live2DControls({
  live2d,
  lastHit,
  onChange,
}: {
  live2d: Live2D;
  lastHit: string[];
  onChange: () => void;
}) {
  const expressions = getExpressions(live2d);
  const motionGroups = getMotionGroups(live2d);
  const memory = live2d.memory;

  return (
    <div
      style={{
        pointerEvents: "auto",
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: 8,
      }}
    >
      <p>
        Expression: {String(memory.currentExpressionId ?? "-")}
        {" | "}
        Motion:{" "}
        {memory.currentMotion
          ? `${memory.currentMotion.group}#${memory.currentMotion.index}`
          : "-"}
        {" | "}
        Last hit areas: {lastHit.length ? lastHit.join(", ") : "-"}
      </p>

      {expressions.length > 0 && (
        <div>
          <strong>Expressions</strong>
          <div>
            {expressions.map((expression) => (
              <button
                key={expression.id}
                onClick={async () => {
                  await live2d.expression(expression.id);
                  onChange();
                }}
              >
                {expression.name}
              </button>
            ))}
            <button
              onClick={async () => {
                await live2d.expression();
                onChange();
              }}
            >
              Random
            </button>
          </div>
        </div>
      )}

      {motionGroups.map(([group, count]) => (
        <div key={group}>
          <strong>{group}</strong>
          <div>
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                onClick={async () => {
                  await live2d.motion(group, index);
                  onChange();
                }}
              >
                #{index}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
