import Link from "next/link";

/** On-brand "back to home" nav used on sub-pages (/spike, /decrypt). */
export function BackToHome() {
  return (
    <Link href="/" className="glow-btn inline-flex items-center gap-1.5">
      <span aria-hidden="true">&larr;</span> Back to Wrapscan
    </Link>
  );
}
