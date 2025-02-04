// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@api3/contracts/v0.8/interfaces/IProxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Api3AggregatorAdaptor is Ownable {

    address public assetProxy;
    address public UsdcUsdProxy;
    string public name;

    uint8 private constant DECIMALS = 8;

    constructor(address _assetProxy, address _UsdcUsdProxy, string memory _name) Ownable() {
        assetProxy = _assetProxy;
        UsdcUsdProxy = _UsdcUsdProxy;
        name = _name;
    }

    function latestAnswer() external view returns (int256 value) {
        (int256 UsdcUsdPrice, ) = readDataFeed(UsdcUsdProxy);
        (int256 assetPrice, ) = readDataFeed(assetProxy);
        uint256 _value = ((uint256(assetPrice) * (10**18)) / uint256(UsdcUsdPrice)) / 10**10;
        value = int256(_value);
    }

    function latestTimestamp() external view returns (uint256 timestamp) {
        ( , timestamp) = readDataFeed(assetProxy);
    }
    
    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

        // Updating the proxy address is a security-critical action.
    function changeProxyAddress(address _assetProxy, address _UsdcUsdProxy) external onlyOwner {
        assetProxy = _assetProxy;
        UsdcUsdProxy = _UsdcUsdProxy;
    }

    function readDataFeed(address _proxy)
        internal
        view
        returns (int224 value, uint256 timestamp)
    {
        (value, timestamp) = IProxy(_proxy).read();
        // If you have any assumptions about `value` and `timestamp`, make sure
        // to validate them right after reading from the proxy. For example,
        // if the value you are reading is the spot price of an asset, you may
        // want to reject non-positive values...
        // require(value > 0, "Value not positive");
        // ...and if the data feed is being updated with a one day-heartbeat
        // interval, you may want to check for that.
        // require(
        //     timestamp + 1 days > block.timestamp,
        //     "Timestamp older than one day"
        // );
        // Try to be strict about validations, but be wary of:
        // (1) Overly strict validation that may invalidate valid values
        // (2) Mutable validation parameters that are controlled by a trusted
        // party (eliminates the trust-minimization guarantees of first-party
        // oracles)
        // (3) Validation parameters that need to be tuned according to
        // external conditions (if these are forgotten to be handled, it will
        // result in (1), look up the Venus Protocol exploit related to LUNA)

        // After validation, you can implement your contract logic here.
    }

    function getTokenType() external pure returns (uint256) {
        return 1;
    }
}