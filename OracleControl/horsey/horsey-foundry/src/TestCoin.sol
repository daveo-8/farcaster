// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./ERC20.sol"; // Use local ERC20 implementation

contract TestCoin is ERC20 {
    constructor() ERC20("TestCoin", "TST") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }

    function transfer(address from, address to, uint256 amount) public {
        transferFrom(from, to, amount);
    }
}