export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const shiftLedgerAbi = [
  {
    type: "function",
    name: "settleBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "workers", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "roles", type: "string[]" },
      { name: "shiftPeriod", type: "string" },
      { name: "payrollHash", type: "bytes32" },
    ],
    outputs: [{ name: "batchId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getWorkerReceipts",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [{ type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "receipts",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "id", type: "bytes32" },
      { name: "batchId", type: "bytes32" },
      { name: "employer", type: "address" },
      { name: "worker", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "shiftPeriod", type: "string" },
      { name: "role", type: "string" },
      { name: "paidAt", type: "uint256" },
      { name: "payrollHash", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "receiptCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "BatchSettled",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "employer", type: "address", indexed: true },
      { name: "workerCount", type: "uint256", indexed: false },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "shiftPeriod", type: "string", indexed: false },
      { name: "payrollHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
