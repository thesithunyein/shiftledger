import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAIN_ID = 11155111;

async function main() {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log("Deployer:", deployer.account.address);
  console.log("Chain:", await publicClient.getChainId());

  const usdc = await viem.deployContract("MockUSDC", []);
  console.log("MockUSDC:", usdc.address);

  const ledger = await viem.deployContract("ShiftLedger", [usdc.address]);
  console.log("ShiftLedger:", ledger.address);

  const mintAmount = 10_000n * 10n ** 6n;
  const mintTx = await usdc.write.mint([deployer.account.address, mintAmount]);
  await publicClient.waitForTransactionReceipt({ hash: mintTx });

  const deployment = {
    network: "sepolia",
    chainId: CHAIN_ID,
    deployedAt: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      mockUsdc: usdc.address,
      shiftLedger: ledger.address,
    },
  };

  const outDir = join(__dirname, "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "sepolia.json");
  writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("Wrote", outPath);

  const fePath = join(__dirname, "..", "..", "frontend", "src", "config", "deployments.sepolia.json");
  mkdirSync(dirname(fePath), { recursive: true });
  writeFileSync(fePath, JSON.stringify(deployment, null, 2));
  console.log("Wrote", fePath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
