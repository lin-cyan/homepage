import React from "react";
import styles from "./page.module.css";
import Image from "next/image";
import PostImage from "@/components/PostImage/PostImage";
import CanvasView from "@/components/CanvasView/CanvasView";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import {marked}  from "marked";
import 'katex/dist/katex.min.css';
import katex from "katex";
async function getData(id) {
  const headersList = await headers();
  const host = headersList.get("host");
  const res = await fetch(`http://${host}/api/posts/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return notFound()
  }

  return res.json();
}


export async function generateMetadata({ params }) {

  const { id } = await params;
  const post = await getData(id)
  return {
    title: post.title,
    description: post.desc,
  };
}

const BlogPost = async ({ params }) => {
  const { id } = await params;
  const data = await getData(id)
  // if (data.externalArticle && data.content) {
    
  //   return redirect(data.content);
  // }
  // 创建一个自定义渲染器
  const renderer = new marked.Renderer();

  
  // 重写renderer的代码块渲染方法来支持数学公式
  renderer.code = function(code, language) {
    
    if (language === "math-c") {
      // 使用katex来渲染数学公式
      return `<div align="center">${katex.renderToString(code)}</div>`;
    }
    if (language === "math") {
      // 使用katex来渲染数学公式
      return `<div>${katex.renderToString(code)}</div>`;
    }
    // 对于其他语言，使用默认的代码块渲染
    return `<pre><code>${code}</code></pre>`;
  };

  // 使用自定义渲染器
  marked.setOptions({ renderer });

  return (
    <div className={styles.container}>
      <div className={styles.top}>
        <div className={styles.info}>
          <h1 className={styles.title}>{data.title}</h1>
          <p className={styles.desc}>
            {data.desc}
          </p>
          <div className={styles.author}>
            <Image
              src="/ico.png"
              alt=""
              width={40}
              height={40}
              className={styles.avatar}
            />
            <span className={styles.username}>Linqing</span>
          </div>
        </div>
        <div className={styles.imageContainer}>
          <PostImage
            src={data.img}
            alt=""
            fill={true}
            className={styles.image}
          />
        </div>
      </div>
      <div className={styles.content}>
        {/* <p className={styles.text}> */}
          {data.isCanvas ? (
            <CanvasView data={data.canvasData} title={data.title} className={styles.canvas} />
          ) : (
            <div dangerouslySetInnerHTML={{__html: marked(data.content)}} />
          )}
         {/* {data.content} */}
      </div>
    </div>
  );
};

export default BlogPost;
