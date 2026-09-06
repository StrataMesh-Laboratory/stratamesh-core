// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title StrataCatalog1155 — lab catalog lots (ERC-1155 shape)
/// @notice Mirrors catalog **lots** (not STRATA NFT object_id, not land, not Subjects).
/// PoC mint role only. No workers.dev registry. No faucet.
contract StrataCatalog1155 is ERC1155, AccessControl {
    bytes32 public constant POC_MINTER_ROLE = keccak256("POC_MINTER_ROLE");

    constructor(address admin, string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POC_MINTER_ROLE, admin);
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata data)
        external
        onlyRole(POC_MINTER_ROLE)
    {
        _mint(to, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external onlyRole(POC_MINTER_ROLE) {
        _mintBatch(to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
