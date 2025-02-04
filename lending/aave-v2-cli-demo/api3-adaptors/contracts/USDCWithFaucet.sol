// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDCTOKEN is ERC20, Ownable {
    constructor() Ownable() ERC20("USDC", "USDC") {
        _mint(msg.sender, 100000000 * 10 ** decimals()); // Mint 100,000,000 WBTC tokens with 18 decimals
    }

    function decimals() override  public view virtual returns (uint8) {
        return 6;
    }

    function faucet() public {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}