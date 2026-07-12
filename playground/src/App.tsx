import { canvas, Game, narration, stepHistory } from "@drincs/pixi-vn";
import { Live2D } from "@drincs/pixi-vn-live2d";
import { useEffect, useState } from "react";
import Live2DControls from "./Live2DControls";
import { baseLabel, expressionLabel, interactiveLabel, motionLabel } from "./labels";

const LABELS = [baseLabel, motionLabel, expressionLabel, interactiveLabel];

export default function App() {
  const [running, setRunning] = useState(false);
  const [, forceUpdate] = useState(0);
  const [lastHit, setLastHit] = useState<string[]>([]);

  useEffect(() => {
    Game.onEnd(() => {
      canvas.clear();
      setRunning(false);
      setLastHit([]);
    });
  }, []);

  const live2d = canvas.find<Live2D>("live2d");

  useEffect(() => {
    if (!live2d) return;
    const handler = (...args: unknown[]) => setLastHit(args[0] as string[]);
    live2d.on("hit", handler);
    return () => {
      live2d.off("hit", handler);
    };
  }, [live2d]);

  async function selectLabel(label: (typeof LABELS)[number]) {
    setRunning(true);
    await Game.start(label, {});
    forceUpdate((n) => n + 1);
  }

  async function handleContinue() {
    await narration.continue({});
    forceUpdate((n) => n + 1);
  }

  async function handleBack() {
    await stepHistory.back({});
    forceUpdate((n) => n + 1);
  }

  if (running) {
    return (
      <div>
        <button style={{ pointerEvents: "auto" }} onClick={handleContinue}>
          Continue
        </button>
        <button
          style={{ pointerEvents: "auto" }}
          onClick={handleBack}
          disabled={!stepHistory.canGoBack}
        >
          Back
        </button>
        {live2d && (
          <Live2DControls
            live2d={live2d}
            lastHit={lastHit}
            onChange={() => forceUpdate((n) => n + 1)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {LABELS.map((label) => (
        <button
          style={{ pointerEvents: "auto" }}
          key={label.id}
          onClick={() => selectLabel(label)}
        >
          {label.id}
        </button>
      ))}
    </div>
  );
}
