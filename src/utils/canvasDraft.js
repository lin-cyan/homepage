// Dashboard 与全屏画板之间通过 sessionStorage 传递未保存的表单（仅限当前标签页）。
const DRAFT_KEY = "dashboard:canvasDraft";

export function saveCanvasDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadCanvasDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCanvasDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}
