import { canvas, narration, newLabel } from "@drincs/pixi-vn";
import { Live2D } from "@drincs/pixi-vn-live2d";

interface ModelConfig {
  alias: string;
  label: string;
  source: string;
}

// Official/free-to-use sample models, used here purely for demonstration purposes.
const models: ModelConfig[] = [
  {
    alias: "shizuku",
    label: "Shizuku (Cubism 2)",
    source:
      "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json",
  },
  {
    alias: "haru",
    label: "Haru (Cubism 4)",
    source:
      "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json",
  },
  {
    alias: "hiyori",
    label: "Hiyori (Cubism 4)",
    source:
      "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples/Samples/Resources/Hiyori/Hiyori.model3.json",
  },
  {
    alias: "mao",
    label: "Mao (Cubism 4)",
    source:
      "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples/Samples/Resources/Mao/Mao.model3.json",
  },
];

interface AddLive2DProps {
  alias: string;
  source: string;
  xPercentage: number;
}

const addLive2DLabel = newLabel<AddLive2DProps>("addLive2DLabel", [
  async ({ alias, source, xPercentage }) => {
    const live2d = await Live2D.create({ source });
    // Sample models don't share a common design resolution (some are a few times
    // taller/wider than the game canvas), so scale each one to a consistent height.
    const targetHeight = canvas.height * 0.9;
    live2d.scale.set(targetHeight / live2d.height);
    live2d.anchor.set(0.5, 1);
    live2d.position.set(canvas.width * xPercentage, canvas.height);
    canvas.add(alias, live2d);
  },
]);

export default function App() {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        display: "flex",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      {models.map(({ alias, label, source }, index) => (
        <button
          key={alias}
          onClick={() =>
            narration.call(addLive2DLabel, {
              alias,
              source,
              xPercentage: (index + 1) / (models.length + 1),
            })
          }
        >
          Add {label}
        </button>
      ))}
    </div>
  );
}
