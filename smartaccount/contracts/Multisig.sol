// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event DelegationCreated(
        address indexed owner,
        address indexed delegate,
        uint256 dailyLimit,
        uint256 timestamp
    );
    event DelegationRevoked(address indexed owner, address indexed delegate);
    event DelegatedTransfer(
        address indexed delegate,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    struct Delegation {
        address delegate;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastResetTime;
        bool isActive;
        uint256 numConfirmations;
    }

    // mapping from tx index => owner => bool
    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    // delegate address => Delegation
    mapping(address => Delegation) public delegations;
    // delegate => owner => bool for delegation confirmations
    mapping(address => mapping(address => bool)) public delegationConfirmations;

    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier onlyDelegateOrOwner() {
        require(
            isOwner[msg.sender] || (delegations[msg.sender].isActive && delegations[msg.sender].delegate == msg.sender),
            "not authorized"
        );
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "tx already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function submitDelegation(address _delegate, uint256 _dailyLimit)
        public
        onlyOwner
    {
        require(_delegate != address(0), "invalid delegate address");
        require(_dailyLimit > 0, "invalid daily limit");
        require(!delegations[_delegate].isActive, "delegation exists");

        // Create delegation in memory first
        Delegation memory newDelegation = Delegation({
            delegate: _delegate,
            dailyLimit: _dailyLimit,
            spentToday: 0,
            lastResetTime: block.timestamp,
            isActive: false,
            numConfirmations: 0
        });

        // Store the delegation
        delegations[_delegate] = newDelegation;
        
        // Auto-confirm for the submitter
        delegationConfirmations[_delegate][msg.sender] = true;
        delegations[_delegate].numConfirmations = 1;

        emit DelegationCreated(
            msg.sender,
            _delegate,
            _dailyLimit,
            block.timestamp
        );
    }

    function confirmDelegation(address _delegate) 
        public 
        onlyOwner 
    {
        Delegation storage delegation = delegations[_delegate];
        require(!delegation.isActive, "delegation already active");
        require(!delegationConfirmations[_delegate][msg.sender], "already confirmed");
        
        delegationConfirmations[_delegate][msg.sender] = true;
        delegation.numConfirmations += 1;

        // Check if we have enough confirmations to activate
        if (delegation.numConfirmations >= numConfirmationsRequired) {
            delegation.isActive = true;
        }

        emit ConfirmTransaction(msg.sender, uint256(uint160(_delegate)));
    }

    function revokeDelegation(address _delegate) public onlyOwner {
        require(delegations[_delegate].isActive, "not active delegation");
        
        // Clear delegation and confirmations
        delete delegations[_delegate];
        for (uint i = 0; i < owners.length; i++) {
            delete delegationConfirmations[_delegate][owners[i]];
        }

        emit DelegationRevoked(msg.sender, _delegate);
    }

    function getDelegationStatus(address _delegate)
        public
        view
        returns (
            uint256 dailyLimit,
            uint256 spentToday,
            uint256 remainingToday,
            uint256 timeUntilReset,
            uint256 confirmations,
            bool isActive
        )
    {
        Delegation memory delegation = delegations[_delegate];
        require(delegation.delegate != address(0), "delegation not found");

        uint256 timeSinceReset = block.timestamp - delegation.lastResetTime;
        uint256 currentSpent = delegation.spentToday;
        uint256 remaining = delegation.dailyLimit;

        // If 24 hours have passed, spending would reset
        if (timeSinceReset >= 24 hours) {
            currentSpent = 0;
            remaining = delegation.dailyLimit;
        } else {
            remaining = delegation.dailyLimit - delegation.spentToday;
        }

        return (
            delegation.dailyLimit,
            currentSpent,
            remaining,
            timeSinceReset >= 24 hours ? 0 : 24 hours - timeSinceReset,
            delegation.numConfirmations,
            delegation.isActive
        );
    }

    function delegatedTransfer(address _to, uint256 _amount)
        public
        returns (bool)
    {
        require(_to != address(0), "invalid recipient");
        require(_amount > 0, "invalid amount");

        // Load delegation into memory for gas optimization
        Delegation memory delegation = delegations[msg.sender];
        require(delegation.isActive, "not an active delegate");
        require(delegation.delegate == msg.sender, "not authorized");

        // Check if 24 hours have passed and we need to reset
        uint256 timeSinceReset = block.timestamp - delegation.lastResetTime;
        if (timeSinceReset >= 24 hours) {
            delegation.spentToday = 0;
            delegation.lastResetTime = block.timestamp;
        }

        // Check remaining limit
        require(delegation.spentToday + _amount <= delegation.dailyLimit, "exceeds daily limit");

        // Update state
        delegation.spentToday += _amount;
        delegations[msg.sender] = delegation;

        // Perform transfer
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "transfer failed");

        emit DelegatedTransfer(msg.sender, _to, _amount, block.timestamp);
        return true;
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}