// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Demo USDC for Sepolia — employer faucet + batch payroll demos.
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("ShiftLedger USD", "sUSD") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Employer demo faucet — up to 10,000 sUSD per call.
    function faucet(uint256 amount) external {
        require(amount > 0 && amount <= 10_000 * 1e6, "faucet: amount");
        _mint(msg.sender, amount);
    }
}
