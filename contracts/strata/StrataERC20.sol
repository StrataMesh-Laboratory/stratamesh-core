// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title StrataERC20 — lab PoC fungible STRATA
/// @notice Mint is gated by POC_MINTER_ROLE only. No faucet. oracle_live=false.
contract StrataERC20 is ERC20, AccessControl {
    bytes32 public constant POC_MINTER_ROLE = keccak256("POC_MINTER_ROLE");

    constructor(address admin) ERC20("STRATA Lab", "L-STRATA") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POC_MINTER_ROLE, admin);
    }

    /// @dev PoC-only mint. Production emission stays off-chain / PdC until oracle_live.
    function mint(address to, uint256 amount) external onlyRole(POC_MINTER_ROLE) {
        _mint(to, amount);
    }
}
