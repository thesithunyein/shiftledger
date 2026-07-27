import assert from "node:assert/strict";
import { parseUnits } from "viem";
import { network } from "hardhat";

describe("ShiftLedger", function () {
  it("settles batch and stores worker receipts", async function () {
    const { viem } = await network.connect();
    const [employer, worker1, worker2] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const usdc = await viem.deployContract("MockUSDC", []);
    const ledger = await viem.deployContract("ShiftLedger", [usdc.address]);

    const amount1 = parseUnits("100", 6);
    const amount2 = parseUnits("200", 6);
    const total = amount1 + amount2;

    await usdc.write.mint([employer.account.address, total]);
    await usdc.write.approve([ledger.address, total], { account: employer.account });

    const hash = await ledger.write.settleBatch(
      [[worker1.account.address, worker2.account.address], [amount1, amount2], ["Operator", "QC"], "2026-W30", "0x" + "ab".repeat(32)],
      { account: employer.account }
    );
    await publicClient.waitForTransactionReceipt({ hash });

    const bal1 = await usdc.read.balanceOf([worker1.account.address]);
    const bal2 = await usdc.read.balanceOf([worker2.account.address]);
    assert.equal(bal1, amount1);
    assert.equal(bal2, amount2);

    const receipts = await ledger.read.getWorkerReceipts([worker1.account.address]);
    assert.equal(receipts.length, 1);

    const r = await ledger.read.receipts([receipts[0]]);
    assert.equal(r[6], "Operator");
    assert.equal(r[4], amount1);
  });

  it("rejects empty batch", async function () {
    const { viem } = await network.connect();
    const [employer] = await viem.getWalletClients();

    const usdc = await viem.deployContract("MockUSDC", []);
    const ledger = await viem.deployContract("ShiftLedger", [usdc.address]);

    await assert.rejects(
      ledger.write.settleBatch([[], [], [], "2026-W30", "0x" + "00".repeat(32)], {
        account: employer.account,
      })
    );
  });
});
