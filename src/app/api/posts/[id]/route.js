import { NextResponse } from "next/server";
import connect from "@/utils/db";
import Post from "@/models/Post";
import { preparePostBody } from "@/utils/postBody";

export const GET = async (request, { params }) => {
  const { id } = await params;

  try {
    await connect();

    const post = await Post.findById(id);

    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Database Error", code: err.code || "DATABASE_ERROR" },
      { status: 500 }
    );
  }
};

export const DELETE = async (request, { params }) => {
  const { id } = await params;

  try {
    await connect();

    const post = await Post.findByIdAndDelete(id);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Database Error", code: err.code || "DATABASE_ERROR" },
      { status: 500 }
    );
  }
};

export const PUT = async(req,{params})=>{
  const { id } = await params;
  const body = await req.json();
  
  try {
    await connect();

    // 文章类型在创建后锁定，以数据库中的 isCanvas 为准
    const existing = await Post.findById(id).select("isCanvas").lean();
    if (!existing) {
      return new NextResponse("Post not found", { status: 404 });
    }
    const update = preparePostBody(body, Boolean(existing.isCanvas));
    const updatePost = await Post.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    return NextResponse.json(updatePost);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Database Error" }, { status: 400 });
  }
};
