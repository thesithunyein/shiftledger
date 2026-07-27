type Props = { size?: number; className?: string };

/** Exact brand logo on clean white tile — matches README / source asset. */
export function BrandMark({ size = 40, className = "" }: Props) {
  return (
    <span
      className={`brand-mark-wrap ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <img src="/logo.png" alt="" draggable={false} aria-hidden="true" />
    </span>
  );
}
