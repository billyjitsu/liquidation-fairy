// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {FlashLoanReceiverBase} from "@aave/protocol-v2/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import {ILendingPool} from "@aave/protocol-v2/contracts/interfaces/ILendingPool.sol";
import {ILendingPoolAddressesProvider} from "@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol";
import {IERC20} from "@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol";

interface IGenericDex {
    function swap(address _fromToken, address _toToken, uint256 _amount) external;
    function getBalance(address _token) external view returns (uint256);
}

contract FlashLoanDex is FlashLoanReceiverBase {
    address payable public owner;
    IGenericDex public dex;

    constructor(address _addressProvider, address _dexAddress)
        public
        FlashLoanReceiverBase(ILendingPoolAddressesProvider(_addressProvider))
    {
        owner = payable(msg.sender);
        dex = IGenericDex(_dexAddress);
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(assets.length == 1, "This contract expects one asset");
        
        address tokenReceivedFromLiquidation = abi.decode(params, (address));

        performLiquidationAndSwap(assets[0], amounts[0], tokenReceivedFromLiquidation);
        
        uint256 amountOwing = amounts[0] + premiums[0];
        IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);

        return true;
    }

    function performLiquidationAndSwap(
        address flashLoanAsset, 
        uint256 flashLoanAmount,
        address tokenReceivedFromLiquidation
    ) internal {

        // Swap back to repay the flash loan
        uint256 liquidationTokenBalance = IERC20(tokenReceivedFromLiquidation).balanceOf(address(this));
        IERC20(tokenReceivedFromLiquidation).approve(address(dex), liquidationTokenBalance);
        dex.swap(tokenReceivedFromLiquidation, flashLoanAsset, liquidationTokenBalance);

        // Ensure we have enough to repay the loan
        uint256 finalBalance = IERC20(flashLoanAsset).balanceOf(address(this));
        require(finalBalance >= flashLoanAmount, "Not enough tokens to repay the loan");
    }

    function requestFlashLoan(address _flashAsset, uint256 _amount, address _tokenReceivedFromLiquidation) external onlyOwner {
        address receiverAddress = address(this);
        address[] memory assets = new address[](1);
        assets[0] = _flashAsset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _amount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        bytes memory params = abi.encode(_tokenReceivedFromLiquidation);

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            address(this),
            params,
            0
        );
    }

    function getBalance(address _tokenAddress) external view returns (uint256) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    function withdraw(address _tokenAddress) external onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    receive() external payable {}
}