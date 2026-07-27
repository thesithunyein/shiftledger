// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ShiftLedger — on-chain receipts for industrial shift payroll batches.
/// @notice Employers batch-settle stablecoin wages; each worker gets an immutable receipt.
contract ShiftLedger is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Receipt {
        bytes32 id;
        bytes32 batchId;
        address employer;
        address worker;
        uint256 amount;
        string shiftPeriod;
        string role;
        uint256 paidAt;
        bytes32 payrollHash;
    }

    IERC20 public immutable paymentToken;
    uint256 public receiptCount;

    mapping(bytes32 => Receipt) public receipts;
    mapping(address => bytes32[]) private _workerReceiptIds;
    mapping(address => bytes32[]) private _employerBatchIds;
    mapping(bytes32 => bytes32[]) private _batchReceiptIds;

    event BatchSettled(
        bytes32 indexed batchId,
        address indexed employer,
        uint256 workerCount,
        uint256 totalAmount,
        string shiftPeriod,
        bytes32 payrollHash
    );

    event ShiftPaid(
        bytes32 indexed receiptId,
        bytes32 indexed batchId,
        address indexed worker,
        uint256 amount,
        string role
    );

    constructor(address token_) {
        require(token_ != address(0), "token");
        paymentToken = IERC20(token_);
    }

    /// @notice Pull USDC from employer and pay each worker; emit verifiable receipts.
    function settleBatch(
        address[] calldata workers,
        uint256[] calldata amounts,
        string[] calldata roles,
        string calldata shiftPeriod,
        bytes32 payrollHash
    ) external nonReentrant returns (bytes32 batchId) {
        uint256 n = workers.length;
        require(n > 0 && n == amounts.length && n == roles.length, "length");

        uint256 total;
        for (uint256 i; i < n; ++i) {
            require(workers[i] != address(0) && amounts[i] > 0, "invalid row");
            total += amounts[i];
        }

        batchId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, payrollHash, receiptCount, block.prevrandao)
        );

        paymentToken.safeTransferFrom(msg.sender, address(this), total);

        for (uint256 i; i < n; ++i) {
            bytes32 receiptId = keccak256(abi.encodePacked(batchId, workers[i], i, receiptCount));
            receipts[receiptId] = Receipt({
                id: receiptId,
                batchId: batchId,
                employer: msg.sender,
                worker: workers[i],
                amount: amounts[i],
                shiftPeriod: shiftPeriod,
                role: roles[i],
                paidAt: block.timestamp,
                payrollHash: payrollHash
            });
            _workerReceiptIds[workers[i]].push(receiptId);
            _batchReceiptIds[batchId].push(receiptId);
            receiptCount++;
            paymentToken.safeTransfer(workers[i], amounts[i]);
            emit ShiftPaid(receiptId, batchId, workers[i], amounts[i], roles[i]);
        }

        _employerBatchIds[msg.sender].push(batchId);
        emit BatchSettled(batchId, msg.sender, n, total, shiftPeriod, payrollHash);
    }

    function getWorkerReceipts(address worker) external view returns (bytes32[] memory) {
        return _workerReceiptIds[worker];
    }

    function getEmployerBatches(address employer) external view returns (bytes32[] memory) {
        return _employerBatchIds[employer];
    }

    function getBatchReceipts(bytes32 batchId) external view returns (bytes32[] memory) {
        return _batchReceiptIds[batchId];
    }
}
