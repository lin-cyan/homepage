"use client";

import Link from "next/link";
import PostImage from "@/components/PostImage/PostImage";
import Pagination from "@/components/Pagination/Pagination";
import styles from "./page.module.css";

export default function BlogClient({ data, pagination, error = "" }) {
  const posts = Array.isArray(data) ? data : [];

  return (
    <main className={styles.mainContainer}>
      {error && <p className={styles.stateMessage} role="alert">{error}</p>}
      {!error && posts.length === 0 && (
        <p className={styles.stateMessage}>暂时还没有文章。</p>
      )}
      {posts.map((item, index) => {
        const content = (
          <>
            <div className={styles.imageContainer}>
              <PostImage
                src={item.img}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 360px"
                className={styles.image}
                priority={index < 2}
              />
            </div>
            <div className={styles.content}>
              <p className={styles.tag}>{item.tag || "Article"}</p>
              <h1 className={styles.title}>{item.title}</h1>
              <p className={styles.desc}>{item.desc}</p>
            </div>
          </>
        );

        return item.externalArticle ? (
          <a key={item._id} href={item.content} target="_blank" rel="noopener noreferrer" className={styles.container}>{content}</a>
        ) : (
          <Link key={item._id} href={`/blog/${item._id}`} className={styles.container}>{content}</Link>
        );
      })}
      {!error && (
        <Pagination
          currentPage={pagination?.page}
          totalPages={pagination?.totalPages}
          basePath="/blog"
          ariaLabel="Blog pages"
        />
      )}
    </main>
  );
}
