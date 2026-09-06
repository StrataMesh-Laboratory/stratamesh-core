// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ObjectRegistry — lab scaffold (OpenZeppelin Ownable mechanics)
/// @notice Maps object_id → CID. Does not mint STRATA. Does not take USDC.
/// Fog operator is owner. SCA/ACB are subjects off-chain (MUD Subject table).
/// Compatible with @openzeppelin/contracts/access/Ownable.sol when installed.

contract ObjectRegistry {
    address public owner;

    struct Object {
        bytes16 objectId;
        string cid;
        address holder;
        bool movable;
        bool exists;
    }

    mapping(bytes16 => Object) public objects;

    event Registered(bytes16 indexed objectId, string cid, address holder);
    event Transferred(bytes16 indexed objectId, address indexed from, address indexed to);

    error NotOwner();
    error ParcelImmovable();
    error MissingCid();
    error NoStrataMint();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address next) external onlyOwner {
        owner = next;
    }

    function register(bytes16 objectId, string calldata cid, bool movable) external onlyOwner {
        if (bytes(cid).length == 0) revert MissingCid();
        objects[objectId] = Object(objectId, cid, owner, movable, true);
        emit Registered(objectId, cid, owner);
    }

    function transfer(bytes16 objectId, address to) external {
        Object storage o = objects[objectId];
        if (!o.exists) revert MissingCid();
        if (!o.movable) revert ParcelImmovable();
        address from = o.holder;
        o.holder = to;
        emit Transferred(objectId, from, to);
    }

    /// @dev Intentionally unimplemented. STRATA is not an ERC-20 on this chain.
    function mintStrata(address, uint256) external pure {
        revert NoStrataMint();
    }
}
