type Area = "Public" | "Student" | "Career Services" | "Head" | "President";

type Props = {
  title: string;
  area: Area;
  /** Screen ID in docs/12-ui-spec.md, e.g. "S2" */
  spec: string;
};

/** Temporary stand-in for a screen that hasn't been built yet. */
export function PagePlaceholder({ title, area, spec }: Props) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{area}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Not built yet. See screen {spec} in docs/12-ui-spec.md.
      </p>
    </section>
  );
}
