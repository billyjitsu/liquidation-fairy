// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Not actual implementation of MockWETH, just a ERC20 token with 18 decimals for testing purposes.

contract MockWETH is ERC20 {
    constructor(string memory TokenName, string memory TokenSymbol) ERC20(TokenName, TokenSymbol) {
        _mint(msg.sender, 1000 * 10 ** decimals()); // Mint 1000 MockWETH tokens with 18 decimals
    }
}