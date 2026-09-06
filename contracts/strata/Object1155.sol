// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Object1155 — catalog lots / editions (NOT object_id NFTs)
/// @notice Compatible with OZ ERC1155 shape. lot_id ≠ object_id; lots are not land and not Subjects.
/// Fungible STRATA value mint stays on ERC-20 PoC / PdC — `mintStrata` always reverts.
/// No faucet. Land parcels stay Object/Parcel rows + title contratos.

contract Object1155 {
    address public owner;
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    mapping(uint256 => string) public cidOf;

    error NotOwner();
    error MissingCid();
    error NoFaucet();
    error NoStrataMint();

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event URI(string value, uint256 indexed id);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function mint(address to, uint256 id, uint256 amount, string calldata cid) external onlyOwner {
        if (bytes(cid).length == 0) revert MissingCid();
        cidOf[id] = cid;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
        emit URI(cid, id);
    }

    function faucet(address, uint256, uint256) external pure {
        revert NoFaucet();
    }

    function mintStrata(address, uint256) external pure {
        revert NoStrataMint();
    }

    function uri(uint256 id) external view returns (string memory) {
        return cidOf[id];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from || msg.sender == owner, "not operator");
        uint256 bal = balanceOf[id][from];
        require(bal >= amount, "balance");
        balanceOf[id][from] = bal - amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
}
