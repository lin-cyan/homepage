import { headers } from "next/headers";
import BlogClient from "./BlogClient";

const POSTS_PER_PAGE = 6;

async function getData(page) {
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const response = await fetch(`${protocol}://${host}/api/posts?visible=true&page=${page}&limit=${POSTS_PER_PAGE}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = payload.code === "MONGODB_NOT_CONFIGURED"
        ? "博客数据库尚未配置。请在 .env.local 中设置 MONGODB_URI，然后重启开发服务器。"
        : "文章暂时无法加载，请稍后重试。";
      return { posts: [], pagination: null, error };
    }

    const payload = await response.json();
    if (!Array.isArray(payload.posts) || !payload.pagination) {
      return { posts: [], error: "文章数据格式异常，请稍后重试。" };
    }

    return { posts: payload.posts, pagination: payload.pagination, error: "" };
  } catch {
    return { posts: [], error: "文章服务暂时不可用，请稍后重试。" };
  }
}

export default async function Blog({ searchParams }) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params?.page, 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { posts, pagination, error } = await getData(page);

  return <BlogClient data={posts} pagination={pagination} error={error} />;
}
