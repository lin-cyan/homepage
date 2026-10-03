import { getStroke } from "perfect-freehand";

// 坐标单位统一为“画布宽度”：x ∈ [0, 1]，y ∈ [0, height]，笔画粗细也以宽度为单位。
// 这样加长纸张只需修改 height，已有笔画无需换算。
// 渲染时映射到宽度为 LOGICAL_WIDTH 的逻辑坐标系，再由 SVG viewBox / canvas scale 缩放到实际尺寸。
export const LOGICAL_WIDTH = 1000;
export const MAX_PAGES = 20;

// value 为宽 / 高，单页高度 = 1 / value
export const ASPECT_RATIOS = [
  { label: "横向 4:3", value: 4 / 3 },
  { label: "横向 16:9", value: 16 / 9 },
  { label: "方形 1:1", value: 1 },
  { label: "竖向 3:4", value: 3 / 4 },
  { label: "竖向 9:16", value: 9 / 16 },
];

export function round4(value) {
  return Math.round(value * 10000) / 10000;
}

export function createCanvasData(aspectRatio = 4 / 3) {
  const pageHeight = round4(1 / aspectRatio);
  return { version: 2, pageHeight, height: pageHeight, background: "#ffffff", strokes: [] };
}

export function findAspectRatio(pageHeight) {
  return ASPECT_RATIOS.find((ratio) => Math.abs(round4(1 / ratio.value) - pageHeight) < 0.001);
}

export function normalizeCanvasData(data) {
  if (!data || typeof data !== "object") return createCanvasData();
  const background = typeof data.background === "string" ? data.background : "#ffffff";
  const strokes = Array.isArray(data.strokes) ? data.strokes.filter((stroke) => Array.isArray(stroke?.points)) : [];

  // v1：y 相对于画布高度，按 aspectRatio 换算成相对于宽度
  if (data.version !== 2) {
    const aspectRatio = Number(data.aspectRatio) > 0 ? Number(data.aspectRatio) : 4 / 3;
    const pageHeight = round4(1 / aspectRatio);
    return {
      version: 2,
      pageHeight,
      height: pageHeight,
      background,
      strokes: strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map(([x, y, pressure]) => [x, round4(y / aspectRatio), pressure]),
      })),
    };
  }

  const pageHeight = Number(data.pageHeight) > 0 ? Number(data.pageHeight) : 0.75;
  const height = Math.min(Math.max(Number(data.height) || pageHeight, pageHeight), pageHeight * MAX_PAGES);
  return { version: 2, pageHeight, height, background, strokes };
}

// 把一条笔画转换成逻辑坐标系下的 SVG path（填充轮廓）。
export function strokeToPath(stroke, last = true) {
  const points = stroke.points.map(([x, y, pressure = 0.5]) => [x * LOGICAL_WIDTH, y * LOGICAL_WIDTH, pressure]);
  const outline = getStroke(points, {
    size: stroke.size * LOGICAL_WIDTH,
    thinning: stroke.tool === "eraser" ? 0 : 0.55,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !stroke.pen,
    last,
  });
  return outlineToPath(outline);
}

function outlineToPath(outline) {
  if (!outline.length) return "";
  const round = (value) => Math.round(value * 100) / 100;
  const parts = [`M${round(outline[0][0])},${round(outline[0][1])}`, "Q"];
  for (let index = 0; index < outline.length; index += 1) {
    const [x0, y0] = outline[index];
    const [x1, y1] = outline[(index + 1) % outline.length];
    parts.push(`${round(x0)},${round(y0)} ${round((x0 + x1) / 2)},${round((y0 + y1) / 2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

// tool 为 "eraser" 的笔画是局部橡皮：用背景色覆盖
export function strokeColor(stroke, background) {
  return stroke.tool === "eraser" ? background : stroke.color;
}

const boundsCache = new WeakMap();

// 笔画包围盒（含半个笔宽），单位为画布宽度
export function strokeBounds(stroke) {
  let bounds = boundsCache.get(stroke);
  if (!bounds) {
    const pad = stroke.size / 2;
    bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    stroke.points.forEach(([x, y]) => {
      bounds.minX = Math.min(bounds.minX, x - pad);
      bounds.minY = Math.min(bounds.minY, y - pad);
      bounds.maxX = Math.max(bounds.maxX, x + pad);
      bounds.maxY = Math.max(bounds.maxY, y + pad);
    });
    boundsCache.set(stroke, bounds);
  }
  return bounds;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0), 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 整笔橡皮的命中检测：橡皮圆与笔画中心线的距离小于两者半径之和即命中
export function strokeHit(stroke, [x, y], radius) {
  const reach = radius + stroke.size / 2;
  const bounds = strokeBounds(stroke);
  if (x < bounds.minX - radius || x > bounds.maxX + radius || y < bounds.minY - radius || y > bounds.maxY + radius) return false;
  const { points } = stroke;
  if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]) <= reach;
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(x, y, points[index - 1], points[index]) <= reach) return true;
  }
  return false;
}
