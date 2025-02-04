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

contract FlashLoanLiquidationSwap is FlashLoanReceiverBase {
    address payable public owner;
    IGenericDex public dex;

    struct LiquidationParams {
        address collateralAsset;
        address borrower;
    }

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
        
        (address collateralAsset, address borrower) = abi.decode(params, (address, address));
        LiquidationParams memory liquidationParams = LiquidationParams(collateralAsset, borrower);

        performLiquidationAndSwap(assets[0], amounts[0], liquidationParams);
        
        uint256 amountOwing = amounts[0] + premiums[0];
        IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);

        return true;
    }

    function performLiquidationAndSwap(
        address debtAsset,
        uint256 debtAmount,
        LiquidationParams memory params
    ) internal {
        // Approve the LendingPool to use the flash loaned amount
        IERC20(debtAsset).approve(address(LENDING_POOL), debtAmount);

        // Get the initial balance of collateral asset
        uint256 initialCollateralBalance = IERC20(params.collateralAsset).balanceOf(address(this));

        // Perform the liquidation
        LENDING_POOL.liquidationCall(
            params.collateralAsset,
            debtAsset,
            params.borrower,
            debtAmount,
            false  // receive aToken false
        );

        // Calculate the liquidated collateral amount
        uint256 liquidatedCollateralAmount = IERC20(params.collateralAsset).balanceOf(address(this)) - initialCollateralBalance;

        // Swap the received collateral back to the debt asset
        if (liquidatedCollateralAmount > 0) {
            IERC20(params.collateralAsset).approve(address(dex), liquidatedCollateralAmount);
            dex.swap(params.collateralAsset, debtAsset, liquidatedCollateralAmount);
        }

        // Ensure we have enough to repay the loan
        uint256 finalBalance = IERC20(debtAsset).balanceOf(address(this));
        require(finalBalance >= debtAmount, "Not enough tokens to repay the loan");
    }

    function requestFlashLoanAndLiquidate(
        address _debtAsset, 
        uint256 _debtAmount, 
        address _collateralAsset,
        address _borrower
    ) external onlyOwner {
        address receiverAddress = address(this);
        address[] memory assets = new address[](1);
        assets[0] = _debtAsset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _debtAmount;
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        bytes memory params = abi.encode(_collateralAsset, _borrower);

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