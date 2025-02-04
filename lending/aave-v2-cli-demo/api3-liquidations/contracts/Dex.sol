// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {IERC20} from "@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import {SafeMath} from "@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/SafeMath.sol";

interface IERC20Detailed is IERC20 {
    function decimals() external view returns (uint8);
}

contract GenericDex {
    using SafeMath for uint256;

    address payable public owner;

    struct TokenPair {
        IERC20Detailed tokenA;
        IERC20Detailed tokenB;
        uint256 rateAtoB;
        uint256 rateBtoA;
    }

    mapping(bytes32 => TokenPair) public tokenPairs;
    mapping(address => mapping(address => uint256)) public tokenBalances;

    uint256 private constant RATE_MULTIPLIER = 1e18;

    constructor() public {
        owner = payable(msg.sender);
    }

    function addTokenPairWithDeposit(
        address _tokenA,
        address _tokenB,
        uint256 _rateAtoB,
        uint256 _rateBtoA,
        uint256 _amountA,
        uint256 _amountB
    ) external onlyOwner {
        require(_tokenA != _tokenB, "Tokens must be different");
        require(_amountA > 0 && _amountB > 0, "Initial deposits must be greater than 0");

        bytes32 pairId = keccak256(abi.encodePacked(_tokenA, _tokenB));
        bytes32 reversePairId = keccak256(abi.encodePacked(_tokenB, _tokenA));
        require(address(tokenPairs[pairId].tokenA) == address(0), "Token pair already exists");

        // Create the token pair
        tokenPairs[pairId] = TokenPair(
            IERC20Detailed(_tokenA),
            IERC20Detailed(_tokenB),
            _rateAtoB,
            _rateBtoA
        );
        
        tokenPairs[reversePairId] = TokenPair(
            IERC20Detailed(_tokenB),
            IERC20Detailed(_tokenA),
            _rateBtoA,
            _rateAtoB
        );

        // Deposit tokenA
        IERC20(_tokenA).transferFrom(msg.sender, address(this), _amountA);
        tokenBalances[address(this)][_tokenA] = tokenBalances[address(this)][_tokenA].add(_amountA);

        // Deposit tokenB
        IERC20(_tokenB).transferFrom(msg.sender, address(this), _amountB);
        tokenBalances[address(this)][_tokenB] = tokenBalances[address(this)][_tokenB].add(_amountB);
    }

    function deposit(address _token, uint256 _amount) external {
        require(_amount > 0, "Deposit amount must be greater than 0");
        tokenBalances[address(this)][_token] = tokenBalances[address(this)][_token].add(_amount);
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    }

    function swap(address _fromToken, address _toToken, uint256 _amount) external {
        bytes32 pairId = keccak256(abi.encodePacked(_fromToken, _toToken));
        TokenPair storage pair = tokenPairs[pairId];
        require(address(pair.tokenA) != address(0), "Token pair does not exist");

        uint256 rate = (address(pair.tokenA) == _fromToken) ? pair.rateAtoB : pair.rateBtoA;
        uint256 toAmount = calculateToAmount(_fromToken, _toToken, _amount, rate);

        require(tokenBalances[address(this)][_toToken] >= toAmount, "Insufficient liquidity");

        IERC20(_fromToken).transferFrom(msg.sender, address(this), _amount);
        IERC20(_toToken).transfer(msg.sender, toAmount);

        tokenBalances[address(this)][_fromToken] = tokenBalances[address(this)][_fromToken].add(_amount);
        tokenBalances[address(this)][_toToken] = tokenBalances[address(this)][_toToken].sub(toAmount);
    }

    function previewSwap(address _fromToken, address _toToken, uint256 _amount) external view returns (uint256) {
        bytes32 pairId = keccak256(abi.encodePacked(_fromToken, _toToken));
        TokenPair storage pair = tokenPairs[pairId];
        require(address(pair.tokenA) != address(0), "Token pair does not exist");

        uint256 rate = (address(pair.tokenA) == _fromToken) ? pair.rateAtoB : pair.rateBtoA;
        return calculateToAmount(_fromToken, _toToken, _amount, rate);
    }

    function calculateToAmount(address _fromToken, address _toToken, uint256 _amount, uint256 _rate) internal view returns (uint256) {
        uint8 fromDecimals = IERC20Detailed(_fromToken).decimals();
        uint8 toDecimals = IERC20Detailed(_toToken).decimals();
        
        uint256 adjustedAmount = _amount.mul(RATE_MULTIPLIER).div(10**uint256(fromDecimals));
        uint256 rawToAmount = adjustedAmount.mul(_rate).div(RATE_MULTIPLIER);
        return rawToAmount.mul(10**uint256(toDecimals)).div(RATE_MULTIPLIER);
    }

    function getBalance(address _token) external view returns (uint256) {
        return tokenBalances[address(this)][_token];
    }

    function withdraw(address _token, uint256 _amount) external onlyOwner {
        require(tokenBalances[address(this)][_token] >= _amount, "Insufficient balance");
        tokenBalances[address(this)][_token] = tokenBalances[address(this)][_token].sub(_amount);
        IERC20(_token).transfer(msg.sender, _amount);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    receive() external payable {}
}