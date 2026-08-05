import { cn } from "@/lib/utils"

type SkeletonVariant = 'pulse' | 'shimmer';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** WP-3.4: 'shimmer' = Liquid Loading mit brand-farbiger Welle. 'pulse' = klassischer Skeleton. */
  variant?: SkeletonVariant;
}

function Skeleton({
  className,
  variant = 'pulse',
  ...props
}: SkeletonProps) {
  return (
    <div
      data-variant={variant}
      className={cn(
        variant === 'pulse' && "animate-pulse rounded-md bg-muted",
        variant === 'shimmer' && "skeleton-shimmer rounded-md",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
