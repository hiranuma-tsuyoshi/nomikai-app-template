import Link from "next/link";

const demoScreens = [
  {
    href: "/play?preview=1",
    label: "参加者（回答・最終確認）",
  },
  {
    href: "/host",
    label: "司会者（進行管理）",
  },
  {
    href: "/host/questions?preview=1",
    label: "司会者（お題管理）",
  },
  {
    href: "/stage?preview=1",
    label: "会場スクリーン（回答公開・得点発表）",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper-white">
      <header className="border-b-2 border-line-soft">
        <div className="mx-auto flex w-full max-w-[880px] items-center gap-3 px-6 py-4">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-eager-green text-base font-extrabold text-night-ink"
          >
            以
          </span>
          <p className="text-sm font-extrabold text-charcoal">
            以心伝心ゲーム
          </p>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-rounded text-[32px] font-extrabold leading-tight tracking-tight text-charcoal">
          以心伝心ゲーム
        </h1>
        <p className="mt-3 text-sm leading-6 text-pencil-gray">
          お題に答えて、チームの回答がどれだけ揃うかを競います。
          得点は一致率×10です。
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button type="button" className="btn btn-primary min-h-14">
            ルームを作る
          </button>
          <Link href="/play" className="btn btn-secondary min-h-14">
            参加する
          </Link>
        </div>

        <nav
          aria-labelledby="demo-heading"
          className="mt-10 border-t-2 border-line-soft pt-5"
        >
          <h2
            id="demo-heading"
            className="text-caption font-bold text-pencil-gray"
          >
            画面デモ
          </h2>
          <ul className="mt-2 divide-y-2 divide-line-soft">
            {demoScreens.map((screen) => (
              <li key={screen.href}>
                <Link
                  href={screen.href}
                  className="flex min-h-12 items-center justify-between gap-4 text-sm font-bold text-spark-blue-ink hover:underline"
                >
                  {screen.label}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <footer className="border-t-2 border-line-soft">
        <div className="mx-auto w-full max-w-[880px] px-6 py-4 text-caption text-pencil-gray">
          v0.2
        </div>
      </footer>
    </main>
  );
}
