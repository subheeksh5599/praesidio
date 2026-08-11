import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">PRAESIDIO</span>
        <Link
          href="/console"
          className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open console
        </Link>
      </header>

      <section className="mt-24">
        <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight">
          A 24/7 guardian for the people who back FXRP.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          FAssets agents hold real XRP as collateral for every FXRP they issue.
          When the price drops, their vault can be liquidated — real money,
          gone in minutes. PRAESIDIO watches vault health every second, acts
          automatically when danger hits, and writes a signed record of every
          action to the chain.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/console"
            className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Open the console
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-line px-5 py-3 text-sm font-semibold hover:bg-sage"
          >
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="mt-32 grid gap-6 md:grid-cols-3">
        {[
          {
            n: "1",
            t: "Watch",
            d: "The guardian reads the vault's collateral and liquidation state from the chain, with the live XRP price, around the clock.",
          },
          {
            n: "2",
            t: "Defend",
            d: "When the vault becomes liquidatable, the guardian executes the defense — automatically, inside a confidential enclave, per the policy you set.",
          },
          {
            n: "3",
            t: "Prove",
            d: "Every action is signed by the enclave and recorded on-chain. Anyone can open the ledger and verify the guardian behaved.",
          },
        ].map((s) => (
          <div key={s.n} className="card p-6">
            <span className="text-xs font-bold text-pine">{s.n}</span>
            <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 rounded-2xl bg-sage p-8">
        <h2 className="text-2xl font-bold">What runs where</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <div className="card p-4">
            <p className="font-bold">Inside the enclave (confidential)</p>
            <p className="mt-1 text-muted">
              The decision logic and the defense key. Strategy stays private;
              no one can copy it or interfere with it.
            </p>
          </div>
          <div className="card p-4">
            <p className="font-bold">On the chain (verifiable)</p>
            <p className="mt-1 text-muted">
              The policy you commit, and the signed action ledger. Anyone can
              verify what the guardian did, and when.
            </p>
          </div>
          <div className="card p-4">
            <p className="font-bold">On Coston2 (testnet)</p>
            <p className="mt-1 text-muted">
              Live vaults, live prices, real transactions. Nothing simulated.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-24 border-t border-line pt-8 text-sm text-muted">
        PRAESIDIO — confidential guardian for FAssets vaults. Built on Flare
        Confidential Compute, FAssets, FTSO v2.
      </footer>
    </main>
  );
}
