import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import LiveProof from "@/components/live-proof";

const PIPELINE = [
  {
    verb: "Watch",
    body: "Reads vault collateral and liquidation state from the chain, with the live XRP price, on a schedule.",
  },
  {
    verb: "Defend",
    body: "Signs the defense action per the policy you commit, inside a confidential enclave where the strategy stays private.",
  },
  {
    verb: "Prove",
    body: "Records every enclave-signed action on-chain, so anyone can verify what the guardian did.",
  },
];

const LAYERS = [
  {
    label: "L1",
    name: "Console",
    desc: "Watch, defend, prove. Real reads and real transactions, zero mocks.",
  },
  {
    label: "L2",
    name: "GuardianRegistry",
    desc: "The on-chain policy and the signed action ledger. Holds no funds.",
  },
  {
    label: "L3",
    name: "Enclave",
    desc: "Flare Confidential Compute. The decision logic and the defense key, private.",
  },
  {
    label: "L4",
    name: "Coston2",
    desc: "FAssets agent vaults and the FTSO v2 XRP price. The ground truth.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      <header className="flex h-16 items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">PRAESIDIO</span>
        <Link href="/watch" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Open console
        </Link>
      </header>

      <section className="pt-24 pb-32 md:pt-32">
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
          Guarded privately.
          <br />
          Proven publicly.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
          PRAESIDIO watches FAssets agent vaults from inside a confidential
          enclave, tops up before liquidation, and writes a signed record of
          every action.
        </p>
        <div className="mt-10 flex gap-3">
          <Link href="/watch" className={buttonVariants()}>
            Open console
          </Link>
          <Link href="/watch" className={buttonVariants({ variant: "outline" })}>
            Watch a vault
          </Link>
        </div>
        <LiveProof />
      </section>

      <section className="border-t py-20 md:py-28">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          The guardian loop
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {PIPELINE.map((s) => (
            <div key={s.verb} className="bg-background p-8">
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-primary">
                {s.verb}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t py-20 md:py-28">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Three layers. One guardian.
        </h2>
        <div className="mt-12 grid grid-cols-[3rem_1fr] gap-y-0 md:grid-cols-[4rem_14rem_1fr]">
          {LAYERS.map((l) => (
            <div
              key={l.label}
              className="col-span-2 grid grid-cols-[3rem_1fr] gap-x-6 border-t py-5 md:col-span-3 md:grid-cols-[4rem_14rem_1fr]"
            >
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {l.label}
              </span>
              <span className="font-mono text-sm font-semibold">{l.name}</span>
              <span className="col-start-2 mt-2 max-w-md text-sm leading-relaxed text-muted-foreground md:col-start-3 md:mt-0">
                {l.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex items-center justify-between border-t py-10 text-sm text-muted-foreground">
        <span>
          PRAESIDIO · Flare Confidential Compute · FAssets · FTSO v2
        </span>
        <a
          href="https://github.com/subheeksh5599/praesidio"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary hover:underline"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
