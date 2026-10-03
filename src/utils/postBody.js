import { normalizeCanvasData } from "@/utils/canvas";

// 画布文章不需要 Markdown 内容，也不能作为外部文章；普通文章不保存画布数据。
export function preparePostBody(body, isCanvas) {
  if (isCanvas) {
    return { ...body, isCanvas: true, externalArticle: false, content: "", canvasData: normalizeCanvasData(body.canvasData) };
  }
  const { canvasData, ...rest } = body;
  if (!rest.content?.trim()) {
    const error = new Error("content is required");
    error.status = 400;
    throw error;
  }
  return { ...rest, isCanvas: false };
}
