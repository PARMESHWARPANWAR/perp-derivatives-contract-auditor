export const EXAMPLE_CONTRACTS = {
  perp: {
    label: "Perpetual futures (SimplePerpMarket.sol)",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceOracle {
    function latestPrice() external view returns (uint256 price, uint256 updatedAt);
}

contract SimplePerpMarket {
    struct Position {
        int256 size;
        uint256 margin;
        uint256 entryPrice;
    }

    mapping(address => Position) public positions;
    IPriceOracle public oracle;
    address public admin;
    uint256 public maxLeverage = 10;
    uint256 public liquidationThresholdBps = 500;
    uint256 public fundingRateBps;

    constructor(address _oracle) {
        oracle = _oracle == address(0) ? IPriceOracle(address(0)) : IPriceOracle(_oracle);
        admin = msg.sender;
    }

    function setMaxLeverage(uint256 newLeverage) external {
        require(msg.sender == admin, "not admin");
        maxLeverage = newLeverage;
    }

    function setLiquidationThreshold(uint256 newThresholdBps) external {
        require(msg.sender == admin, "not admin");
        liquidationThresholdBps = newThresholdBps;
    }

    function setFundingRate(uint256 newRateBps) external {
        require(msg.sender == admin, "not admin");
        fundingRateBps = newRateBps;
    }

    function openPosition(int256 size, uint256 margin) external payable {
        require(msg.value == margin, "margin mismatch");
        (uint256 price, ) = oracle.latestPrice();
        uint256 notional = _abs(size) * price;
        require(notional / margin <= maxLeverage, "exceeds max leverage");
        positions[msg.sender] = Position({ size: size, margin: margin, entryPrice: price });
    }

    function liquidate(address trader) external {
        Position storage pos = positions[trader];
        require(pos.margin > 0, "no position");
        (uint256 price, ) = oracle.latestPrice();
        int256 pnl = _computePnl(pos, price);
        uint256 equity = pnl >= 0 ? pos.margin + uint256(pnl) : pos.margin - uint256(-pnl);
        uint256 maintenanceMargin = (_abs(pos.size) * price * liquidationThresholdBps) / 10_000;
        require(equity < maintenanceMargin, "position healthy");
        uint256 reward = (pos.margin * 500) / 10_000;
        uint256 remaining = pos.margin - reward;
        delete positions[trader];
        (bool sentReward, ) = msg.sender.call{value: reward}("");
        require(sentReward, "reward transfer failed");
        if (remaining > 0) {
            (bool sentRemainder, ) = trader.call{value: remaining}("");
            require(sentRemainder, "remainder transfer failed");
        }
    }

    function settleFunding(address trader) external {
        Position storage pos = positions[trader];
        require(pos.margin > 0, "no position");
        int256 payment = (pos.size * int256(fundingRateBps)) / 10_000;
        if (payment > 0) {
            require(pos.margin >= uint256(payment), "insufficient margin for funding");
            pos.margin -= uint256(payment);
        } else {
            pos.margin += uint256(-payment);
        }
    }

    function _computePnl(Position storage pos, uint256 currentPrice) internal view returns (int256) {
        int256 priceDiff = int256(currentPrice) - int256(pos.entryPrice);
        return (pos.size * priceDiff) / int256(pos.entryPrice);
    }

    function _abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }
}`,
  },
  vault: {
    label: "Basic vault (VulnerableVault.sol)",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract VulnerableVault {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");
        balances[msg.sender] -= amount;
    }

    function emergencyWithdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }

    function forwardFunds(address target, uint256 amount) external {
        target.call{value: amount}("");
    }
}`,
  },
  token: {
    label: "Simple token (CleanToken.sol)",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CleanToken {
    string public constant name = "Clean Token";
    string public constant symbol = "CLN";
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 initialSupply) {
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "insufficient allowance");
        allowance[from][msg.sender] = approved - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero recipient");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}`,
  },
} as const;

export type ExampleContractKey = keyof typeof EXAMPLE_CONTRACTS;
