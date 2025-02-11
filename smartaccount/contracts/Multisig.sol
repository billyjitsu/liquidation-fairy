// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed signer,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed signer, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed signer, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed signer, uint256 indexed txIndex);
    event DelegationCreated(
        address indexed signer,
        address indexed delegate,
        address indexed token,
        uint256 dailyLimit,
        uint256 timestamp
    );
    event DelegationRevoked(
        address indexed signer, 
        address indexed delegate,
        address indexed token
    );
    event DelegatedTransfer(
        address indexed delegate,
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    event SignerAdditionProposed(address indexed proposer, address indexed newSigner);
    event SignerAdditionConfirmed(address indexed confirmer, address indexed newSigner);
    event SignerAdded(address indexed newSigner);
    event SignerRemoved(address indexed signer);

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    struct TokenDelegation {
        address delegate;
        address token;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastResetTime;
        bool isActive;
        uint256 numConfirmations;
    }

    struct ProposedSigner {
        address signerAddress;
        uint256 numConfirmations;
        bool isActive;
        mapping(address => bool) hasConfirmed;
    }

    mapping(address => mapping(address => TokenDelegation)) public delegations;
    mapping(address => mapping(address => mapping(address => bool))) public delegationConfirmations;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    mapping(address => ProposedSigner) public proposedSigners;

    Transaction[] public transactions;

    modifier onlySigner() {
        require(isSigner[msg.sender], "not authorized signer");
        _;
    }

    modifier onlyDelegate(address token) {
        require(
            delegations[token][msg.sender].isActive && 
            delegations[token][msg.sender].delegate == msg.sender,
            "not authorized delegate"
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

    modifier notSigner(address _address) {
        require(!isSigner[_address], "address is already a signer");
        _;
    }

    constructor(address[] memory _signers, uint256 _numConfirmationsRequired) {
        require(_signers.length > 0, "signers required");
        require(
            _numConfirmationsRequired > 0 &&
            _numConfirmationsRequired <= _signers.length,
            "invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "invalid signer");
            require(!isSigner[signer], "signer not unique");

            isSigner[signer] = true;
            signers.push(signer);
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
    ) public onlySigner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 1
            })
        );

        isConfirmed[txIndex][msg.sender] = true;
        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    function submitTokenTransaction(
        address _token,
        address _to,
        uint256 _value
    ) public onlySigner {
        require(_token != address(0), "invalid token address");
        
        bytes memory data = abi.encodeWithSelector(
            IERC20.transfer.selector,
            _to,
            _value
        );

        submitTransaction(_token, 0, data);
    }

    function confirmTransaction(uint256 _txIndex)
        public
        onlySigner
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
        onlySigner
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
        onlySigner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function submitDelegation(
        address _token,
        address _delegate,
        uint256 _dailyLimit
    ) public onlySigner {
        require(_delegate != address(0), "invalid delegate address");
        require(_dailyLimit > 0, "invalid daily limit");
        require(!delegations[_token][_delegate].isActive, "delegation exists");

        TokenDelegation memory newDelegation = TokenDelegation({
            delegate: _delegate,
            token: _token,
            dailyLimit: _dailyLimit,
            spentToday: 0,
            lastResetTime: block.timestamp,
            isActive: false,
            numConfirmations: 1
        });

        delegations[_token][_delegate] = newDelegation;
        delegationConfirmations[_token][_delegate][msg.sender] = true;

        emit DelegationCreated(
            msg.sender,
            _delegate,
            _token,
            _dailyLimit,
            block.timestamp
        );
    }

    function confirmDelegation(address _token, address _delegate) 
        public 
        onlySigner 
    {
        TokenDelegation storage delegation = delegations[_token][_delegate];
        require(!delegation.isActive, "delegation already active");
        
        delegationConfirmations[_token][_delegate][msg.sender] = true;
        delegation.numConfirmations += 1;

        if (delegation.numConfirmations >= numConfirmationsRequired) {
            delegation.isActive = true;
        }

        emit ConfirmTransaction(msg.sender, uint256(uint160(_delegate)));
    }

    function revokeDelegation(address _token, address _delegate) public onlySigner {
        require(delegations[_token][_delegate].isActive, "not active delegation");
        
        delete delegations[_token][_delegate];
        for (uint i = 0; i < signers.length; i++) {
            delete delegationConfirmations[_token][_delegate][signers[i]];
        }

        emit DelegationRevoked(msg.sender, _delegate, _token);
    }

    function delegatedTransfer(
        address _token,
        address _to,
        uint256 _amount
    ) public onlyDelegate(_token) returns (bool) {
        require(_to != address(0), "invalid recipient");
        require(_amount > 0, "invalid amount");

        TokenDelegation storage delegation = delegations[_token][msg.sender];
        
        uint256 timeSinceReset = block.timestamp - delegation.lastResetTime;
        if (timeSinceReset >= 24 hours) {
            delegation.spentToday = 0;
            delegation.lastResetTime = block.timestamp;
        }

        require(delegation.spentToday + _amount <= delegation.dailyLimit, "exceeds daily limit");
        
        delegation.spentToday += _amount;

        if (_token == address(0)) {
            (bool success, ) = _to.call{value: _amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(
                IERC20(_token).transfer(_to, _amount),
                "token transfer failed"
            );
        }

        emit DelegatedTransfer(msg.sender, _token, _to, _amount, block.timestamp);
        return true;
    }

    function proposeNewSigner(address _newSigner) 
        public 
        onlySigner 
        notSigner(_newSigner) 
    {
        require(_newSigner != address(0), "invalid signer address");
        require(!proposedSigners[_newSigner].isActive, "signer already proposed");

        ProposedSigner storage proposal = proposedSigners[_newSigner];
        proposal.signerAddress = _newSigner;
        proposal.numConfirmations = 1;
        proposal.isActive = true;
        proposal.hasConfirmed[msg.sender] = true;

        emit SignerAdditionProposed(msg.sender, _newSigner);
    }

    function confirmNewSigner(address _newSigner) 
        public 
        onlySigner 
        notSigner(_newSigner) 
    {
        ProposedSigner storage proposal = proposedSigners[_newSigner];
        require(proposal.isActive, "signer not proposed");
        require(!proposal.hasConfirmed[msg.sender], "already confirmed");

        proposal.hasConfirmed[msg.sender] = true;
        proposal.numConfirmations += 1;

        emit SignerAdditionConfirmed(msg.sender, _newSigner);

        if (proposal.numConfirmations >= numConfirmationsRequired) {
            addSigner(_newSigner);
        }
    }

    function addSigner(address _newSigner) internal {
        signers.push(_newSigner);
        isSigner[_newSigner] = true;
        delete proposedSigners[_newSigner];

        emit SignerAdded(_newSigner);
    }

    function removeSigner(address _signer) 
        public 
        onlySigner 
    {
        require(isSigner[_signer], "not a signer");
        require(
            signers.length - 1 >= numConfirmationsRequired,
            "cannot have fewer signers than required confirmations"
        );

        isSigner[_signer] = false;
        
        for (uint i = 0; i < signers.length; i++) {
            if (signers[i] == _signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(_signer);
    }

    function updateRequiredConfirmations(uint256 _newRequired) 
        public 
        onlySigner 
    {
        require(_newRequired > 0, "invalid number of required confirmations");
        require(
            _newRequired <= signers.length,
            "required confirmations cannot exceed number of signers"
        );
        numConfirmationsRequired = _newRequired;
    }

    function getDelegationStatus(
        address _token,
        address _delegate
    )
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
        TokenDelegation memory delegation = delegations[_token][_delegate];
        require(delegation.delegate != address(0), "delegation not found");

        uint256 timeSinceReset = block.timestamp - delegation.lastResetTime;
        uint256 currentSpent = delegation.spentToday;
        uint256 remaining = delegation.dailyLimit;

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

    function getTokenBalance(address _token) public view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        }
        return IERC20(_token).balanceOf(address(this));
    }

    function getSigners() public view returns (address[] memory) {
        return signers;
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