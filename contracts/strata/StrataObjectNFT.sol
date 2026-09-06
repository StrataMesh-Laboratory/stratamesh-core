// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title StrataObjectNFT — lab object identity (object_id maps to tokenId)
/// @notice Parcels / lots remain immovable via movable flag.
contract StrataObjectNFT is ERC721, AccessControl {
    bytes32 public constant POC_MINTER_ROLE = keccak256("POC_MINTER_ROLE");

    mapping(uint256 => string) private _cids;
    mapping(uint256 => bool) public movable;

    error MissingCid();
    error ParcelImmovable();

    constructor(address admin) ERC721("STRATA Object", "S-OBJ") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POC_MINTER_ROLE, admin);
    }

    function mintObject(address to, uint256 tokenId, string calldata cid, bool isMovable)
        external
        onlyRole(POC_MINTER_ROLE)
    {
        if (bytes(cid).length == 0) revert MissingCid();
        _safeMint(to, tokenId);
        _cids[tokenId] = cid;
        movable[tokenId] = isMovable;
    }

    function cidOf(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return _cids[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !movable[tokenId]) {
            revert ParcelImmovable();
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
