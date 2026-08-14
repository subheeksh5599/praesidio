"use client";

import { useEffect, useState } from "react";

// Live proof numbers for the landing hero — fetched from the real chain via
// /api/state. Shows nothing when the chain is unreachable (the hero stands
// alone; no invented numbers).
type Proof = {
  price: number | null;
  vaults: number;
  configured: boolean;
};

export default function LiveProof() {
  const [p, setP] = useState<Proof | null>(null);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setP({
          price: typeof d?.price === "number" ? d.price : null,
          vaults: Array.isArray(d?.vaults) ? d.vaults.length : 0,
          configured: Boolean(d?.configured),
        })
      )
      .catch(() => setP(null));
  }, []);

  if (!p || !p.configured) return null;

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-sm text-muted-foreground">
      <span>
        <span className="text-foreground">XRP/USD</span>{" "}
        {p.price !== null ? `$${p.price.toFixed(4)}` : "n/a"}
      </span>
      <span>
        <span className="text-foreground">{p.vaults}</span> agent vaults
      </span>
      <span>
        <span className="text-foreground">live</span> on Coston2
      </span>
    </div>
  );
}
