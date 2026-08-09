import Link from "next/link";
import styles from "./Pagination.module.css";

function getPageNumbers(currentPage, totalPages) {
  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

function getPageHref(basePath, page) {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  basePath,
  ariaLabel = "Pages",
}) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <nav className={styles.pagination} aria-label={ariaLabel}>
      {currentPage > 1 ? (
        <Link href={getPageHref(basePath, currentPage - 1)} className={styles.pageLink} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={`${styles.pageLink} ${styles.pageDisabled}`} aria-disabled="true">Previous</span>
      )}

      <div className={styles.pageNumbers}>
        {pageNumbers.map((page, index) => (
          <span key={page} className={styles.pageNumberItem}>
            {index > 0 && page - pageNumbers[index - 1] > 1 && (
              <span className={styles.pageEllipsis} aria-hidden="true">&hellip;</span>
            )}
            <Link
              href={getPageHref(basePath, page)}
              className={`${styles.pageLink} ${page === currentPage ? styles.pageActive : ""}`}
              aria-current={page === currentPage ? "page" : undefined}
              aria-label={`Page ${page}`}
            >
              {page}
            </Link>
          </span>
        ))}
      </div>

      {currentPage < totalPages ? (
        <Link href={getPageHref(basePath, currentPage + 1)} className={styles.pageLink} rel="next">
          Next
        </Link>
      ) : (
        <span className={`${styles.pageLink} ${styles.pageDisabled}`} aria-disabled="true">Next</span>
      )}
    </nav>
  );
}
