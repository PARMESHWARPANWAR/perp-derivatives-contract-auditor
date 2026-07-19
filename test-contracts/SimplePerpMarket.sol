// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Intentionally vulnerable simplified perpetual futures contract, built to
// demo derivatives-specific vulnerability classes that generic static
// analyzers typically miss. Not production code.

interface IPriceOracle {
    function latestPrice() external view returns (uint256 price, uint256 updatedAt);
}

contract SimplePerpMarket {
    struct Position {
        int256 size;        // positive = long, negative = short
        uint256 margin;
        uint256 entryPrice;
    }

    mapping(address => Position) public positions;

    IPriceOracle public oracle;
    address public admin;

    uint256 public maxLeverage = 10;
    uint256 public liquidationThresholdBps = 500; // 5%
    uint256 public fundingRateBps;                // set externally each interval

    constructor(address _oracle) {
        oracle = _oracle == address(0) ? IPriceOracle(address(0)) : IPriceOracle(_oracle);
        admin = msg.sender;
    }

    // --- Risk parameters: no timelock, no governance, instant effect ---
    function setMaxLeverage(uint256 newLeverage) external {
        require(msg.sender == admin, "not admin");
        maxLeverage = newLeverage; // takes effect immediately, no delay
    }

    function setLiquidationThreshold(uint256 newThresholdBps) external {
        require(msg.sender == admin, "not admin");
        liquidationThresholdBps = newThresholdBps;
    }

    function setFundingRate(uint256 newRateBps) external {
        require(msg.sender == admin, "not admin");
        fundingRateBps = newRateBps;
    }

    // --- Trading ---
    function openPosition(int256 size, uint256 margin) external payable {
        require(msg.value == margin, "margin mismatch");

        (uint256 price, ) = oracle.latestPrice(); // no staleness check on the returned timestamp

        uint256 notional = _abs(size) * price;
        require(notional / margin <= maxLeverage, "exceeds max leverage");

        positions[msg.sender] = Position({ size: size, margin: margin, entryPrice: price });
    }

    // --- Liquidation: reward can be gamed via self-liquidation ---
    function liquidate(address trader) external {
        Position storage pos = positions[trader];
        require(pos.margin > 0, "no position");

        (uint256 price, ) = oracle.latestPrice(); // same missing staleness check

        int256 pnl = _computePnl(pos, price);
        uint256 equity = pnl >= 0 ? pos.margin + uint256(pnl) : pos.margin - uint256(-pnl);
        uint256 maintenanceMargin = (_abs(pos.size) * price * liquidationThresholdBps) / 10_000;

        require(equity < maintenanceMargin, "position healthy");

        // Liquidator (which can be the trader's own second address, or the
        // trader themself with no check) receives a flat 5% reward of
        // remaining margin — self-liquidation for a discount is possible.
        uint256 reward = (pos.margin * 500) / 10_000;
        uint256 remaining = pos.margin - reward;

        delete positions[trader];

        (bool sentReward, ) = msg.sender.call{value: reward}("");
        require(sentReward, "reward transfer failed");

        // State already cleared above for the position, but funds still move
        // after external calls elsewhere in real settlement flows — flagged
        // here as a settlement-ordering risk for the auditor to catch.
        if (remaining > 0) {
            (bool sentRemainder, ) = trader.call{value: remaining}("");
            require(sentRemainder, "remainder transfer failed");
        }
    }

    // --- Funding settlement ---
    function settleFunding(address trader) external {
        Position storage pos = positions[trader];
        require(pos.margin > 0, "no position");

        // Funding payment computed directly off admin-set fundingRateBps,
        // which can be changed instantly right before settlement calls with
        // no rate-of-change limit.
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
}
