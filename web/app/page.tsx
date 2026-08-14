import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">PRAESIDIO</span>
        <Link
          href="/watch"
          className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Open console
        </Link>
      </header>

      <section className="mt-24">
        <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight">
          A confidential guardian for the people who back FXRP.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          FAssets agents hold real XRP as collateral for every FXRP they issue.
          When the price drops, their vault can be liquidated — real money,
          gone in minutes. PRAESIDIO watches vault health around the clock,
          decides whether a top-up is needed inside a confidential enclave, and
          writes a signed, on-chain record of every action so anyone can verify
          what the guardian did.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/watch"
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
            d: "The guardian reads the vault's collateral and liquidation state from the chain, with the live XRP price, on a schedule.",
          },
          {
            n: "2",
            t: "Defend",
            d: "When the vault becomes liquidatable, the guardian signs the defense action per the policy you commit — inside a confidential enclave, so the strategy stays private.",
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
              Live vaults, live prices, real transactions. Nothing simulated —
              every number comes from a real chain read.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-24 border-t border-line pt-8 text-sm text-muted">
        PRAESIDIO — confidential guardian for FAssets vaults. Built on Flare
        Confidential Compute, FAssets and FTSO v2. Read the technical detail in{" "}
        <a
          href="https://github.com/subheeksh5599/praesidio"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-pine hover:underline"
        >
          the repo
        </a>
        .
      </footer>
    </main>
  );
}
