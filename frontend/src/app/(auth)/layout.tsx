export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_440px]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-dusk-dark p-10 text-white lg:flex">
        {/* The terminator line: day sweeping into night, which is the whole premise. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'linear-gradient(105deg, #C2703B 0%, #9B562A 18%, #2B3A67 46%, #1E2A4D 100%)',
          }}
        />
        <div className="relative flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-gradient-to-r from-dawn to-dusk" />
          <span className="font-display text-[17px]">Meridian</span>
        </div>

        <div className="relative max-w-md">
          <p className="spec text-white/50">Scheduling across timezones</p>
          <h2 className="mt-4 font-display text-[38px] leading-[1.05]">
            Two clocks. One instant. No confusion.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Every time is shown in both your zone and theirs, side by side. Working hours stay put
            when the clocks change, and the days they change are marked before anyone books.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
          {[
            ['DST-safe', '9am stays 9am'],
            ['Both clocks', 'Always visible'],
            ['Group', 'Collective & round robin'],
          ].map(([term, def]) => (
            <div key={term}>
              <dt className="spec text-white/80">{term}</dt>
              <dd className="mt-1 text-[13px] text-white/50">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex items-center justify-center bg-chalk px-6 py-12">
        <div className="w-full max-w-[340px]">{children}</div>
      </section>
    </main>
  );
}
