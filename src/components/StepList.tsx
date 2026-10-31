/** Numbered vertical timeline on phones, cards from md. */
export function StepList({ steps, columns = 3 }: { steps: { title: string; text: string }[]; columns?: 3 | 4 }) {
  return (
    <ol className={`relative grid gap-0 md:gap-4 ${columns === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0 md:card md:block md:p-6">
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="absolute top-11 bottom-1 left-5 w-px bg-line md:hidden" />
          )}
          <span className="font-display relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night text-lg font-bold text-glow">
            {i + 1}
          </span>
          <div className="pt-1.5 md:pt-0">
            <h3 className="text-lg text-night md:mt-4">{s.title}</h3>
            <p className="mt-1 leading-relaxed text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
