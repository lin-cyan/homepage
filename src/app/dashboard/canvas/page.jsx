"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LOGICAL_WIDTH,
  MAX_PAGES,
  createCanvasData,
  normalizeCanvasData,
  round4,
  strokeBounds,
  strokeColor,
  strokeHit,
  strokeToPath,
} from "@/utils/canvas";
import { loadCanvasDraft, saveCanvasDraft } from "@/utils/canvasDraft";
import styles from "./page.module.css";

const COLORS = ["#222222", "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#7048e8", "#ffffff"];
const PEN_SIZES = [3, 6, 12, 24];
const ERASER_SIZES = [16, 32, 64];
const MAX_HISTORY = 100;
const TOOLS = [
  { id: "pen", label: "画笔" },
  { id: "eraser", label: "局部橡皮" },
  { id: "strokeEraser", label: "整笔橡皮" },
];

const pathCache = new WeakMap();

function strokePath(stroke) {
  let path = pathCache.get(stroke);
  if (!path) {
    path = new Path2D(strokeToPath(stroke));
    pathCache.set(stroke, path);
  }
  return path;
}

// 画布只覆盖可视区域；offset 为可视区域顶部在纸张中的位置（单位：画布宽度）
function prepareContext(canvas, width, height, offset) {
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  const scale = pixelWidth / LOGICAL_WIDTH;
  ctx.setTransform(scale, 0, 0, scale, 0, -offset * LOGICAL_WIDTH * scale);
  return ctx;
}

// 沿橡皮移动轨迹按半径间隔采样，避免快速划过时漏掉笔画
function samplePath(from, to, radius) {
  if (!from) return [to];
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(distance / (radius / 2)));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  });
}

export default function CanvasEditor() {
  const router = useRouter();
  const { status } = useSession();
  const [draft, setDraft] = useState(null);
  const [canvasData, setCanvasData] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState("edit");
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1]);
  const [layout, setLayout] = useState(null);

  const stageRef = useRef(null);
  const paperRef = useRef(null);
  const viewportRef = useRef(null);
  const baseRef = useRef(null);
  const liveRef = useRef(null);
  const gesture = useRef(null);
  const renderRef = useRef(() => {});
  const frameRef = useRef(0);
  const scrollToEndRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/dashboard/login");
  }, [router, status]);

  useEffect(() => {
    const saved = loadCanvasDraft();
    if (!saved?.formData) {
      router.replace("/dashboard");
      return;
    }
    setDraft(saved);
    setCanvasData(normalizeCanvasData(saved.formData.canvasData || createCanvasData()));
  }, [router]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // iPad Safari 的长按 / 双击会触发文字选择、放大镜和双击缩放，CSS 拦不全，
  // 编辑模式下在画布上阻止原生触摸手势（Pointer Events 不受影响）
  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas || mode !== "edit") return undefined;
    const block = (event) => event.preventDefault();
    canvas.addEventListener("touchstart", block, { passive: false });
    canvas.addEventListener("touchmove", block, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", block);
      canvas.removeEventListener("touchmove", block);
    };
  }, [mode, layout]);

  useEffect(() => {
    const block = (event) => event.preventDefault();
    document.addEventListener("selectstart", block);
    return () => document.removeEventListener("selectstart", block);
  }, []);

  const pageHeight = canvasData?.pageHeight;

  // 纸张宽度：撑满可用宽度，但保证单页能完整显示在屏幕内；多页时上下滚动
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !pageHeight) return undefined;
    const fit = () => {
      const availableWidth = stage.clientWidth - 32;
      const availableHeight = stage.clientHeight - 80;
      setLayout({
        width: Math.max(160, Math.floor(Math.min(availableWidth, availableHeight / pageHeight))),
        stageHeight: stage.clientHeight,
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [pageHeight]);

  const paperHeight = layout && canvasData ? layout.width * canvasData.height : 0;
  const viewHeight = layout ? Math.min(layout.stageHeight, paperHeight) : 0;

  function visibleOffset() {
    const paperRect = paperRef.current.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    return (viewportRect.top - paperRect.top) / paperRect.width;
  }

  renderRef.current = () => {
    if (!layout || !canvasData || !baseRef.current || !viewportRef.current) return;
    const offset = visibleOffset();
    const bottom = offset + viewHeight / layout.width;
    const ctx = prepareContext(baseRef.current, layout.width, viewHeight, offset);
    ctx.fillStyle = canvasData.background;
    ctx.fillRect(0, offset * LOGICAL_WIDTH, LOGICAL_WIDTH, (bottom - offset) * LOGICAL_WIDTH);

    // 分页虚线，仅在编辑器中显示
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, .18)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    for (let y = canvasData.pageHeight; y < canvasData.height - 0.0001; y += canvasData.pageHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y * LOGICAL_WIDTH);
      ctx.lineTo(LOGICAL_WIDTH, y * LOGICAL_WIDTH);
      ctx.stroke();
    }
    ctx.restore();

    canvasData.strokes.forEach((stroke) => {
      const bounds = strokeBounds(stroke);
      if (bounds.maxY < offset || bounds.minY > bottom) return;
      ctx.fillStyle = strokeColor(stroke, canvasData.background);
      ctx.fill(strokePath(stroke));
    });
    drawLive(offset);
  };

  function drawLive(offset = visibleOffset()) {
    if (!liveRef.current || !layout) return;
    const ctx = prepareContext(liveRef.current, layout.width, viewHeight, offset);
    const current = gesture.current;
    if (!current) return;
    if (current.stroke) {
      ctx.fillStyle = strokeColor(current.stroke, canvasData.background);
      ctx.fill(new Path2D(strokeToPath(current.stroke, false)));
    }
    if (current.type === "strokeEraser" && current.last) {
      ctx.beginPath();
      ctx.arc(current.last[0] * LOGICAL_WIDTH, current.last[1] * LOGICAL_WIDTH, (eraserSize / 2), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, .45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  useEffect(() => {
    renderRef.current();
    if (scrollToEndRef.current && stageRef.current) {
      scrollToEndRef.current = false;
      stageRef.current.scrollTo({ top: stageRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [canvasData, layout, viewHeight]);

  function handleScroll() {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => renderRef.current());
  }

  const commit = useCallback((next) => {
    setPast((stack) => [...stack.slice(-MAX_HISTORY + 1), canvasData]);
    setFuture([]);
    setCanvasData(next);
    setDirty(true);
  }, [canvasData]);

  function toPoint(event) {
    const rect = paperRef.current.getBoundingClientRect();
    const pressure = event.pointerType === "pen" ? event.pressure || 0.5 : 0.5;
    return [
      round4(Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)),
      round4(Math.min(Math.max((event.clientY - rect.top) / rect.width, 0), canvasData.height)),
      Math.round(pressure * 1000) / 1000,
    ];
  }

  function eraseAlong(point) {
    const current = gesture.current;
    const radius = eraserSize / 2 / LOGICAL_WIDTH;
    const samples = samplePath(current.last, point, radius);
    current.last = point;
    const remaining = current.strokes.filter((stroke) => (
      stroke.tool === "eraser" || !samples.some((sample) => strokeHit(stroke, sample, radius))
    ));
    if (remaining.length !== current.strokes.length) {
      current.strokes = remaining;
      setCanvasData((data) => ({ ...data, strokes: remaining }));
    }
  }

  function handlePointerDown(event) {
    if (gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;

    if (mode === "browse") {
      // 触摸滚动交给浏览器；鼠标按住拖动来滚动
      if (event.pointerType !== "mouse") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { type: "pan", pointerId: event.pointerId, startY: event.clientY, startTop: stageRef.current.scrollTop };
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);

    if (tool === "strokeEraser") {
      gesture.current = { type: "strokeEraser", pointerId: event.pointerId, base: canvasData, strokes: canvasData.strokes, last: null };
      eraseAlong(point);
    } else {
      gesture.current = {
        type: "draw",
        pointerId: event.pointerId,
        stroke: {
          tool,
          color: tool === "eraser" ? null : color,
          size: (tool === "eraser" ? eraserSize : penSize) / LOGICAL_WIDTH,
          pen: event.pointerType === "pen",
          points: [point],
        },
      };
    }
    drawLive();
  }

  function handlePointerMove(event) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;

    if (current.type === "pan") {
      stageRef.current.scrollTop = current.startTop - (event.clientY - current.startY);
      return;
    }

    const events = event.nativeEvent.getCoalescedEvents?.() || [event.nativeEvent];
    events.forEach((item) => {
      const point = toPoint(item);
      if (current.type === "strokeEraser") {
        eraseAlong(point);
        return;
      }
      const { points } = current.stroke;
      const previous = points[points.length - 1];
      if (point[0] !== previous[0] || point[1] !== previous[1]) points.push(point);
    });
    drawLive();
  }

  function handlePointerUp(event) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    gesture.current = null;
    drawLive();

    if (current.type === "draw") {
      commit({ ...canvasData, strokes: [...canvasData.strokes, current.stroke] });
    } else if (current.type === "strokeEraser" && current.strokes !== current.base.strokes) {
      // 删除已在拖动过程中生效，这里只记录历史
      setPast((stack) => [...stack.slice(-MAX_HISTORY + 1), current.base]);
      setFuture([]);
      setDirty(true);
    }
  }

  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture((stack) => [...stack, canvasData]);
    setCanvasData(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setDirty(true);
  }, [canvasData, past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    setPast((stack) => [...stack, canvasData]);
    setCanvasData(future[future.length - 1]);
    setFuture(future.slice(0, -1));
    setDirty(true);
  }, [canvasData, future]);

  useEffect(() => {
    function handleKey(event) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
      if ((key === "z" && event.shiftKey) || key === "y") { event.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);

  function clearAll() {
    if (!canvasData.strokes.length || !window.confirm("确定清空整个画布吗？（可以撤销）")) return;
    commit({ ...canvasData, strokes: [] });
  }

  function addPage() {
    scrollToEndRef.current = true;
    commit({ ...canvasData, height: round4(canvasData.height + canvasData.pageHeight) });
  }

  function removeLastPage() {
    commit({ ...canvasData, height: round4(canvasData.height - canvasData.pageHeight) });
  }

  function cancel() {
    if (dirty && !window.confirm("画布有未保存的修改，确定放弃吗？")) return;
    router.push("/dashboard");
  }

  function save() {
    const saved = saveCanvasDraft({ ...draft, formData: { ...draft.formData, canvasData }, canvasUpdated: true });
    if (!saved) {
      window.alert("画布数据过大，无法暂存，请减少笔画后重试。");
      return;
    }
    router.push("/dashboard");
  }

  if (status !== "authenticated" || !canvasData) {
    return <div className={styles.overlay}><p className={styles.loading}>正在加载画板...</p></div>;
  }

  const pageCount = Math.round(canvasData.height / canvasData.pageHeight);
  const lastPageTop = canvasData.height - canvasData.pageHeight;
  const lastPageEmpty = canvasData.strokes.every((stroke) => strokeBounds(stroke).maxY <= lastPageTop);
  const usesEraserSize = tool !== "pen";
  const currentSize = usesEraserSize ? eraserSize : penSize;
  const sizes = usesEraserSize ? ERASER_SIZES : PEN_SIZES;
  const setCurrentSize = usesEraserSize ? setEraserSize : setPenSize;
  const editing = mode === "edit";

  return (
    <div className={styles.overlay}>
      <header className={styles.toolbar}>
        <div className={`${styles.group} ${styles.modeSwitch}`} role="group" aria-label="模式">
          <button type="button" className={editing ? styles.modeActive : ""} aria-pressed={editing} onClick={() => setMode("edit")}>✏️ 编辑</button>
          <button type="button" className={!editing ? styles.modeActive : ""} aria-pressed={!editing} onClick={() => setMode("browse")}>✋ 浏览</button>
        </div>
        <div className={styles.group}>
          {TOOLS.map((item) => (
            <button type="button" key={item.id} className={tool === item.id ? styles.active : ""} disabled={!editing} onClick={() => setTool(item.id)}>{item.label}</button>
          ))}
        </div>
        {tool === "pen" && (
          <div className={styles.group} aria-label="颜色">
            {COLORS.map((item) => (
              <button
                type="button"
                key={item}
                aria-label={`颜色 ${item}`}
                className={`${styles.swatch} ${color === item ? styles.activeSwatch : ""}`}
                style={{ background: item }}
                disabled={!editing}
                onClick={() => setColor(item)}
              />
            ))}
          </div>
        )}
        <div className={styles.group} aria-label="粗细">
          {sizes.map((item) => (
            <button
              type="button"
              key={item}
              aria-label={`粗细 ${item}`}
              className={`${styles.sizeButton} ${currentSize === item ? styles.active : ""}`}
              disabled={!editing}
              onClick={() => setCurrentSize(item)}
            >
              <span style={{ width: Math.min(item, 22), height: Math.min(item, 22) }} />
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <button type="button" onClick={undo} disabled={!past.length}>撤销</button>
          <button type="button" onClick={redo} disabled={!future.length}>重做</button>
          <button type="button" onClick={clearAll} disabled={!canvasData.strokes.length}>清空</button>
        </div>
        <div className={`${styles.group} ${styles.end}`}>
          <button type="button" onClick={cancel}>取消</button>
          <button type="button" className={styles.primary} onClick={save}>保存</button>
        </div>
      </header>

      <div className={styles.stage} ref={stageRef} onScroll={handleScroll}>
        {layout && (
          <>
            <div className={styles.paper} ref={paperRef} style={{ width: layout.width, height: paperHeight, background: canvasData.background }}>
              <div className={styles.viewport} ref={viewportRef} style={{ height: viewHeight }}>
                <canvas ref={baseRef} className={styles.layer} />
                <canvas
                  ref={liveRef}
                  className={`${styles.layer} ${editing ? styles.drawing : styles.browsing}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
              </div>
            </div>
            <div className={styles.pageActions} style={{ width: layout.width }}>
              <span>共 {pageCount} 页</span>
              <button type="button" onClick={removeLastPage} disabled={pageCount <= 1 || !lastPageEmpty} title={lastPageEmpty ? "删除最后一页" : "最后一页有内容，无法删除"}>删除末页</button>
              <button type="button" onClick={addPage} disabled={pageCount >= MAX_PAGES}>+ 加长一页</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
