import raw from "../config/deployments.sepolia.json";

export type Deployment = {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: string;
  contracts: {
    mockUsdc: string;
    shiftLedger: string;
  };
};

export function getDeployment(): Deployment {
  return raw as Deployment;
}

export function isDeployed(d: Deployment): boolean {
  return Boolean(d.contracts.shiftLedger && d.contracts.mockUsdc);
}

export function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerTx(hash: string) {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export function explorerAddr(addr: string) {
  return `https://sepolia.etherscan.io/address/${addr}`;
}
