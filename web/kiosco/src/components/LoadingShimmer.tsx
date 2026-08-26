export default function LoadingShimmer() {
  return (
    <div className="grid gap-[var(--gap)] p-[var(--pad)]">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[var(--room-h)] rounded-2xl shimmer" />
      ))}
    </div>
  )
}
