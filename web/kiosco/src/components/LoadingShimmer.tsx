export default function LoadingShimmer() {
  return (
    <div className="grid gap-4 p-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[112px] rounded-2xl shimmer" />
      ))}
    </div>
  )
}
