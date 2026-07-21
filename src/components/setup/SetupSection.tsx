export function SetupSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="font-display text-sm font-bold tracking-wide text-muted uppercase">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
