// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockProxy {
    int224 private VALUE = 999903720000000000; // $1.00 
    uint256 private TIMESTAMP = block.timestamp;

    function read() external view returns (int224, uint256) {
        return (VALUE, TIMESTAMP);
    }

    function updateValue(int224 _value) external {
        VALUE = _value;
        TIMESTAMP = block.timestamp;
    }
}