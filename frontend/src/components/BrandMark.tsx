type Props = { size?: number; className?: string };

/** Exact brand logo — light background knocked out on dark UI via blend mode. */
export function BrandMark({ size = 40, className = "" }: Props) {
  return (
    <img
      src="/logo-source.png"
      alt=""
      width={size}
      height={size}
      className={`brand-mark ${className}`.trim()}
      aria-hidden="true"
      draggable={false}
    />
  );
}
