// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Intentionally vulnerable contract for testing the auditor.
// Contains: reentrancy, missing access control, unchecked external call.
contract VulnerableVault {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Vulnerable to reentrancy: external call happens before state update.
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient balance");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");

        balances[msg.sender] -= amount;
    }

    // Missing access control: anyone can drain contract funds.
    function emergencyWithdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }

    // Unchecked return value from low-level call.
    function forwardFunds(address target, uint256 amount) external {
        target.call{value: amount}("");
    }
}
