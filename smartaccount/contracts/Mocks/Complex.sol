// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Mock contract with complex data types
contract MockComplexContract {
    struct PaymentInfo {
        address recipient;
        uint256 amount;
        bytes data;
    }

    event ArraysHandled(uint256[] numbers, bytes[] data, address[] addresses);
    event StructHandled(PaymentInfo info);

    function handleArrays(
        uint256[] memory numbers,
        bytes[] memory data,
        address[] memory addresses
    ) external {
        emit ArraysHandled(numbers, data, addresses);
    }

    function handleStruct(PaymentInfo memory info) external {
        emit StructHandled(info);
    }
}

// Mock contract with payable functions
contract MockPayableContract {
    event PaymentReceived(address from, address recipient, string reason, uint256 amount);

    function handlePayment(address recipient, string memory reason) external payable {
        emit PaymentReceived(msg.sender, recipient, reason, msg.value);
    }

    receive() external payable {}
}