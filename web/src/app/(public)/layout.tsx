import Image from "next/image";
import { redirect } from "next/navigation";
import { BrandMark, Icon, type IconName } from "@/components/icons";
import { getMe, homeFor } from "@/lib/server/api";

const points: [IconName, string, string][] = [
  ["doc", "Apply once per cycle", "Choose up to three organisations or propose your own."],
  ["mail", "Introductory letters, signed and sent", "Career Services emails your letter to the organisation."],
  ["checkCircle", "Track every step", "From interview to completion, in one place."],
];

/** Public screens (P1–P6): split layout on laptops, single column on phones. Signed-in users go to their area. */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const me = await getMe();
  if (me) redirect(homeFor(me.role));
  return (
    <div className="relative grid min-h-full flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#15803d] via-[#116932] to-[#0b3d22] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(var(--ink-text) 1px, transparent 1px), linear-gradient(90deg, var(--ink-text) 1px, transparent 1px)", backgroundSize: "56px 56px" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] rounded-full bg-[#22c55e]/25" aria-hidden />
        <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-white/8" aria-hidden />
        <div className="relative flex items-center gap-4">
          <BrandMark className="size-16" onDark />
          <div className="leading-tight">
            <p className="text-[16px] font-semibold">Palm Career Services</p>
            <p className="text-[13px] text-white/70">Your Career. Our Priority.</p>
          </div>
        </div>
        <div className="relative z-10 my-auto max-w-[65%]">
          <h2 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.015em]">
            Internship placement, <span className="text-[#fcd34d]">from application to completion.</span>
          </h2>
          <ul className="mt-10 grid gap-6">
            {points.map(([icon, title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 flex-none place-items-center rounded-[10px] bg-white/12 text-[#fcd34d]">
                  <Icon name={icon} className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-[13px] text-white/75">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      {/* Student ambassador — straddles the green/white boundary */}
      <Image
        src="/ambassador.png"
        alt=""
        width={380}
        height={420}
        className="pointer-events-none absolute bottom-0 left-[calc(5/11*100%)] z-20 hidden h-[70%] max-h-[540px] w-auto -translate-x-1/2 select-none object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.25)] lg:block"
        aria-hidden
        priority
      />
      <main className="relative flex flex-col overflow-hidden bg-bg px-5 py-10 sm:px-10">
        {/* Big Palm Crest Watermark - centered on the white page */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none z-0"
          aria-hidden="true"
        >
          <Image
            src="/brand/palm-logo-green.png"
            alt=""
            width={600}
            height={600}
            className="size-[360px] sm:size-[460px] lg:size-[560px] max-w-none opacity-[0.06] select-none object-contain"
            priority
          />
        </div>

        <div className="relative z-10 mb-10 flex items-center gap-2.5 lg:hidden">
          <BrandMark className="size-12" />
          <div className="leading-tight">
            <p className="font-semibold">Palm Career Services</p>
            <p className="text-[13px] text-muted">Your Career. Our Priority.</p>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 lg:ml-[28%] lg:mr-auto">{children}</div>
      </main>
    </div>
  );
}
