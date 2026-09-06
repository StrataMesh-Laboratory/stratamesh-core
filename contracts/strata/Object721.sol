// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Object721 — STRATA NFT is the object (object_id)
/// @notice Compatible with OZ ERC721 shape. Lab scaffold only.
/// Ontology: object_id = NFT identity (not CID). SCA/ACB are Subjects off-chain — never tokens.
/// `movable=false` models world **dirt/parcel identity** (no backpack pickup).
/// Ownership **title** trade belongs on Contrato.ownership_title (or a title instrument),
/// not by treating a reverted dirt transfer as "title cannot change".
/// Lots are NOT this contract (see Object1155). No faucet. No STRATA value mint here.

contract Object721 {
    string public constant name = "STRATA Object";
    string public constant symbol = "OBJ";

    address public owner;
    uint256 public nextId;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => string) public cidOf;
    mapping(uint256 => bool) public movable;
    mapping(address => uint256) public balanceOf;

    error NotOwner();
    error ParcelImmovable();
    error MissingCid();
    error NotTokenOwner();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Registered(uint256 indexed tokenId, string cid, bool movable);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function mint(address to, string calldata cid, bool isMovable) external onlyOwner returns (uint256 tokenId) {
        if (bytes(cid).length == 0) revert MissingCid();
        tokenId = ++nextId;
        ownerOf[tokenId] = to;
        cidOf[tokenId] = cid;
        movable[tokenId] = isMovable;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
        emit Registered(tokenId, cid, isMovable);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (ownerOf[tokenId] != from) revert NotTokenOwner();
        if (msg.sender != from && msg.sender != owner) revert NotTokenOwner();
        if (!movable[tokenId]) revert ParcelImmovable();
        ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return cidOf[tokenId];
    }
}
