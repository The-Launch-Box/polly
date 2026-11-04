import Link from "next/link";

type LaunchBoxWordmarkProps = {
  href?: string;
  className?: string;
  /** Render a static mark, for previews that should not navigate. */
  linked?: boolean;
};

/**
 * Header lockup from launch-box-wordmark: orange arrow plus
 * "ACCELERATED BY THE LAUNCH BOX" in Bebas Neue Pro.
 */
export function LaunchBoxWordmark({
  href = "/",
  className,
  linked = true,
}: LaunchBoxWordmarkProps) {
  const classNames = ["lb-lockup", className].filter(Boolean).join(" ");
  const mark = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lb-lockup__mark"
        src="/brand/tlb-arrow.svg"
        alt=""
        width={22}
        height={22}
      />
      <span className="lb-lockup__word">ACCELERATED BY THE LAUNCH BOX</span>
    </>
  );

  if (!linked) {
    return (
      <span className={classNames} aria-label="The Launch Box">
        {mark}
      </span>
    );
  }

  return (
    <Link href={href} className={classNames} aria-label="The Launch Box">
      {mark}
    </Link>
  );
}
