import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STEPS = [
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
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">PRAESIDIO</span>
        <Link href="/watch" className={buttonVariants({ variant: "ghost" })}>
          Open console
        </Link>
      </header>

      <section className="mt-24">
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight">
          A confidential guardian for the people who back FXRP.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          FAssets agents hold real XRP as collateral for every FXRP they issue.
          When the price drops, their vault can be liquidated — real money, gone
          in minutes. PRAESIDIO watches vault health around the clock, decides
          whether a top-up is needed inside a confidential enclave, and writes a
          signed, on-chain record of every action so anyone can verify what the
          guardian did.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/watch" className={buttonVariants()}>
            Open the console
          </Link>
          <a href="#how" className={buttonVariants({ variant: "outline" })}>
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="mt-32 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                {s.n}
              </Badge>
              <CardTitle className="pt-2">{s.t}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{s.d}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-24 rounded-2xl border bg-muted/40 p-8">
        <h2 className="text-2xl font-semibold tracking-tight">What runs where</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Inside the enclave (confidential)</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              The decision logic and the defense key. Strategy stays private; no
              one can copy it or interfere with it.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>On the chain (verifiable)</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              The policy you commit, and the signed action ledger. Anyone can
              verify what the guardian did, and when.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>On Coston2 (testnet)</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Live vaults, live prices, real transactions. Nothing simulated —
              every number comes from a real chain read.
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="mt-24 flex items-center justify-between border-t pt-8 text-sm text-muted-foreground">
        <span>PRAESIDIO — confidential guardian for FAssets vaults. Flare Confidential Compute · FAssets · FTSO v2.</span>
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
