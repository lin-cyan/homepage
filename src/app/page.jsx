import Button from "@/components/Button/Button";
import QuoteRotator from "@/components/QuoteRotator/QuoteRotator";
import connect from "@/utils/db";
import Post from "@/models/Post";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function getQuotes() {
  try {
    await connect();
    const quotes = await Post.aggregate([
      { $match: { isQuote: true } },
      { $sample: { size: 100 } },
      { $project: { _id: 1, title: 1, desc: 1 } },
    ]);
    return JSON.parse(JSON.stringify(quotes));
  } catch {
    return [];
  }
}

export default async function Home() {
  const quotes = await getQuotes();

  return (
    <main className={styles.container}>
      <section className={styles.item}>
        <h1 className={styles.title}>Nature as My Muse, Notes as My Love Language, and Poetry for Soulful Laughter.</h1>
        <p className={styles.desc}>Hi! I am 霖青 (Linqing), but you can just call me Lin. 霖 means the lingering spring rain, and 青 is the lovely color between blue and green. Curious? Click the button below to learn more about me!</p>
        <Button url="/about" text="ABOUT &nbsp;   ME ~" />
      </section>

      <section className={styles.quoteArea} aria-label="Featured quote">
        <QuoteRotator quotes={quotes} styles={styles} />
      </section>
    </main>
  );
}
