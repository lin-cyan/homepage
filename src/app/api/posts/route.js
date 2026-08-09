import { NextResponse } from "next/server";
import connect from "@/utils/db";
import Post from "@/models/Post";

export const GET = async (request) => {
  const url = new URL(request.url);

  
  const username = url.searchParams.get("username");
  const visibleOnly = url.searchParams.get("visible") === "true";
  const quotesOnly = url.searchParams.get("quote") === "true";
  const paginated = url.searchParams.has("page");
  const requestedPage = Number.parseInt(url.searchParams.get("page"), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const requestedLimit = Number.parseInt(url.searchParams.get("limit"), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : paginated ? 10 : 0;

  try {
    await connect();

    const filters = {};
    if (username) filters.username = username;
    if (visibleOnly) filters.showInBlog = { $ne: false };
    if (quotesOnly) filters.isQuote = true;

    const sort = quotesOnly ? { updatedAt: -1 } : { createdAt: -1 };

    if (paginated) {
      const total = await Post.countDocuments(filters);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const currentPage = Math.min(page, totalPages);
      const posts = await Post.find(filters)
        .sort(sort)
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

    const query = Post.find(filters).sort(sort);
    if (limit) query.limit(limit);
    const posts = await query.lean();
    return NextResponse.json(posts);
  } catch (err) {
    const notConfigured = err.code === "MONGODB_NOT_CONFIGURED";
    return NextResponse.json(
      {
        error: notConfigured ? "MongoDB is not configured" : "Database connection failed",
        code: err.code || "DATABASE_ERROR",
      },
      { status: 500 }
    );
  }
};
export const POST = async (request) => {
  const body = await request.json();
  const newPost = new Post(body);
  try {
    await connect();

    await newPost.save();

    return NextResponse.json(newPost, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Database Error" }, { status: 400 });
  }
};

