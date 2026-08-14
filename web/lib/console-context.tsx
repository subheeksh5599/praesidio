"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createWalletClient, custom, defineChain, parseAbi } from "viem";

export type VaultState = {
  vault: string;
  collateralWei?: string;
  liqFactorVaultBIPS?: string;
  liqFactorPoolBIPS?: string;
  maxLiquidationUBA?: string;
  liquidatable?: boolean;
  error?: string;
};

export type GuardAction = {
  type: string;
  amount: string;
  nonce: string;
  timestamp: string;
};

export type GuardState = {
  id: number;
  vault: string;
  owner: string;
  policyRatioBIPS: string;
  topUpAmountWei: string;
  active: boolean;
  actions: GuardAction[];
};

export type ConsoleState = {
  configured: boolean;
  error?: string;
  chain: {
    chainId: number;
    rpcUrl: string;
    assetManager: string;
    guardianRegistry: string;
    ftsoV2: string;
  } | null;
  vaults: VaultState[];
  guards: GuardState[];
  price: number | null;
};

const registryWriteAbi = parseAbi([
  "function registerAgentVault(address, uint64, uint256) returns (uint256)",
  "function setPolicy(uint256, uint64, uint256)",
  "function setGuardActive(uint256, bool)",
]);

const EXPLORER = "https://coston2-explorer.flare.network";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

type ConsoleContextValue = {
  state: ConsoleState | null;
  loading: boolean;
  error: string | null;
  account: string | null;
  walletErr: string | null;
  notice: string | null;
  connect: () => Promise<void>;
  refresh: () => void;
  registerGuard: (vaultAddr: string, ratioBIPS: string, topUpWei: string) => Promise<void>;
  setActive: (id: number, active: boolean) => Promise<void>;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConsoleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        setState(s);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const chainDef = useMemo(
    () =>
      defineChain({
        id: state?.chain?.chainId ?? 114,
        name: "Coston2",
        nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
        rpcUrls: {
          default: { http: [state?.chain?.rpcUrl ?? "https://coston2-api.flare.network/ext/C/rpc"] },
        },
      }),
    [state]
  );

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setWalletErr("No injected wallet found. Install MetaMask and enable it.");
      return;
    }
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const want = `0x${(state?.chain?.chainId ?? 114).toString(16)}`;
      const current = (await eth.request({ method: "eth_chainId" })) as string;
      if (current.toLowerCase() !== want) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: want }] });
        } catch (e) {
          if ((e as { code?: number })?.code === 4902) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: want,
                  chainName: "Flare Testnet Coston2",
                  rpcUrls: [state?.chain?.rpcUrl ?? "https://coston2-api.flare.network/ext/C/rpc"],
                  nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
                },
              ],
            });
          } else throw e;
        }
      }
      setAccount(accounts[0] ?? null);
      setWalletErr(null);
    } catch (e) {
      setWalletErr(e instanceof Error ? e.message : String(e));
    }
  }, [state]);

  const registerGuard = useCallback(
    async (vaultAddr: string, ratioBIPS: string, topUpWei: string) => {
      if (!account || !state?.chain) return;
      if (!/^0x[0-9a-fA-F]{40}$/.test(vaultAddr)) {
        setNotice("Enter a valid vault address (0x…).");
        return;
      }
      try {
        const wallet = createWalletClient({ transport: custom(window.ethereum!) });
        const tx = await wallet.writeContract({
          account: account as `0x${string}`,
          chain: chainDef,
          address: state.chain.guardianRegistry as `0x${string}`,
          abi: registryWriteAbi,
          functionName: "registerAgentVault",
          args: [vaultAddr as `0x${string}`, BigInt(ratioBIPS), BigInt(topUpWei)],
        });
        setNotice(`Register tx sent: ${EXPLORER}/tx/${tx}`);
        setTimeout(refresh, 8000);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      }
    },
    [account, state, chainDef, refresh]
  );

  const setActive = useCallback(
    async (id: number, active: boolean) => {
      if (!account || !state?.chain) return;
      try {
        const wallet = createWalletClient({ transport: custom(window.ethereum!) });
        const tx = await wallet.writeContract({
          account: account as `0x${string}`,
          chain: chainDef,
          address: state.chain.guardianRegistry as `0x${string}`,
          abi: registryWriteAbi,
          functionName: "setGuardActive",
          args: [BigInt(id), active],
        });
        setNotice(`Guard ${id} ${active ? "activated" : "deactivated"}: ${EXPLORER}/tx/${tx}`);
        setTimeout(refresh, 8000);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      }
    },
    [account, state, chainDef, refresh]
  );

  const value: ConsoleContextValue = {
    state,
    loading,
    error,
    account,
    walletErr,
    notice,
    connect,
    refresh,
    registerGuard,
    setActive,
  };

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used within ConsoleProvider");
  return ctx;
}
