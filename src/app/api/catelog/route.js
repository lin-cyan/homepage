import { NextResponse } from "next/server";
import connect from "@/utils/db";
import Post from "@/models/Post";

export const GET = async (request) => {
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag");
  const paginated = url.searchParams.has("page");
  const requestedPage = Number.parseInt(url.searchParams.get("page"), 10);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit"), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : paginated ? 10 : 0;

  try {
    await connect();

    const filters = { tag };

    if (paginated) {
      const total = await Post.countDocuments(filters);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const currentPage = Math.min(page, totalPages);
      const posts = await Post.find(filters)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .lean();

      return NextResponse.json({
        posts,
        pagination: {
          page: currentPage,
          pageSize: limit,
          total,
          totalPages,
        },
      });
    }

    const query = Post.find(filters).sort({ createdAt: -1 });
    if (limit) query.limit(limit);
    const posts = await query.lean();

    return NextResponse.json(posts);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Database connection failed",
        code: err.code || "DATABASE_ERROR",
      },
      { status: 500 }
    );
  }
};
