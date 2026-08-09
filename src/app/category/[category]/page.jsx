import { Fragment } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import Pagination from "@/components/Pagination/Pagination";
import PostImage from "@/components/PostImage/PostImage";
import styles from "./page.module.css";

const POSTS_PER_PAGE = 6;

async function getCategoryPosts(category, page) {
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const query = new URLSearchParams({
      tag: category,
      page: String(page),
      limit: String(POSTS_PER_PAGE),
    });
    const response = await fetch(`${protocol}://${host}/api/catelog?${query}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { posts: [], pagination: null, error: "Articles are temporarily unavailable. Please try again later." };
    }

    const payload = await response.json();
    if (!Array.isArray(payload.posts) || !payload.pagination) {
      return { posts: [], pagination: null, error: "The article data could not be loaded." };
    }

    return { posts: payload.posts, pagination: payload.pagination, error: "" };
  } catch {
    return { posts: [], pagination: null, error: "Articles are temporarily unavailable. Please try again later." };
  }
}

export default async function Category({ params, searchParams }) {
  const { category } = await params;
  const query = await searchParams;
  const requestedPage = Number.parseInt(query?.page, 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const { posts, pagination, error } = await getCategoryPosts(category, page);

  return (
    <main className={styles.mainContainer}>
      {error && <p className={styles.stateMessage} role="alert">{error}</p>}
      {!error && posts.length === 0 && (
        <p className={styles.stateMessage}>There are no articles in this category yet.</p>
      )}

      {posts.map((item) => (
        <Fragment key={item._id}>
          <Link href={`/blog/${item._id}`} className={styles.container}>
            <div className={styles.imageContainer}>
              <PostImage
                src={item.img}
                alt=""
                width={400}
                height={250}
                className={styles.image}
              />
            </div>
            <div className={styles.content}>
              <h1 className={styles.title}>{item.title}</h1>
              <p className={styles.desc}>{item.desc}</p>
            </div>
          </Link>
          <hr className={styles.articleSeparator} />
        </Fragment>
      ))}

      {!error && (
        <Pagination
          currentPage={pagination?.page}
          totalPages={pagination?.totalPages}
          basePath={`/category/${encodeURIComponent(category)}`}
          ariaLabel={`${category} category pages`}
        />
      )}
    </main>
  );
}
