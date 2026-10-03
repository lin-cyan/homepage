import { LOGICAL_WIDTH, normalizeCanvasData, strokeColor, strokeToPath } from "@/utils/canvas";

// 只读展示：渲染成 SVG，随容器宽度等比缩放，可在服务端直接输出。
export default function CanvasView({ data, className, title = "手绘画布" }) {
  const canvas = normalizeCanvasData(data);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${canvas.height * LOGICAL_WIDTH}`}
      role="img"
      aria-label={title}
      style={{ display: "block", width: "100%", height: "auto", background: canvas.background }}
    >
      {canvas.strokes.map((stroke, index) => (
        <path key={index} d={strokeToPath(stroke)} fill={strokeColor(stroke, canvas.background)} />
      ))}
    </svg>
  );
}
