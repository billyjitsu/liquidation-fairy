const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
    let wallet;
    let token;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let delegate;
    let signers;

    const oneEther = ethers.parseEther("1.0");
    const tokenAmount = ethers.parseEther("1000.0");
    const dailyLimit = ethers.parseEther("10.0");

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3, delegate] = await ethers.getSigners();
        
        // Convert signer objects to addresses for the constructor
        signers = [
            await owner.getAddress(),
            await addr1.getAddress(),
            await addr2.getAddress()
        ];

        // Deploy MultiSigWallet
        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        wallet = await MultiSigWallet.deploy(signers, 2n); // Requires 2 confirmations
        await wallet.waitForDeployment();

        // Deploy Mock ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy(
            "Mock Token",
            "MTK",
            tokenAmount
        );
        await token.waitForDeployment();

        // Transfer tokens to MultiSig wallet
        await token.transfer(await wallet.getAddress(), tokenAmount / 2n);
    });

    describe("Deployment", function () {
        it("Should set the correct signers and confirmation requirement", async function () {
            expect(await wallet.numConfirmationsRequired()).to.equal(2n);
            expect(await wallet.isSigner(await owner.getAddress())).to.be.true;
            expect(await wallet.isSigner(await addr1.getAddress())).to.be.true;
            expect(await wallet.isSigner(await addr2.getAddress())).to.be.true;
            expect(await wallet.isSigner(await addr3.getAddress())).to.be.false;
        });

        it("Should receive ETH", async function () {
            const walletAddress = await wallet.getAddress();
            await owner.sendTransaction({
                to: walletAddress,
                value: oneEther
            });
            const balance = await ethers.provider.getBalance(walletAddress);
            expect(balance).to.equal(oneEther);
        });
    });

    describe("Transaction Management", function () {
        it("Should submit and confirm ETH transaction", async function () {
            const walletAddress = await wallet.getAddress();
            // First fund the wallet
            await owner.sendTransaction({
                to: walletAddress,
                value: oneEther
            });

            // Submit transaction
            const recipientAddress = await addr3.getAddress();
            await wallet.submitTransaction(recipientAddress, ethers.parseEther("0.5"), "0x");
            
            // Confirm with second signer
            await wallet.connect(addr1).confirmTransaction(0);

            // Check transaction details
            const tx = await wallet.getTransaction(0);
            expect(tx.numConfirmations).to.equal(2n);
        });

        it("Should execute confirmed transaction", async function () {
            const walletAddress = await wallet.getAddress();
            // Fund the wallet
            await owner.sendTransaction({
                to: walletAddress,
                value: oneEther
            });

            const recipientAddress = await addr3.getAddress();
            const amount = ethers.parseEther("0.5");
            const initialBalance = await ethers.provider.getBalance(recipientAddress);

            // Submit and confirm transaction
            await wallet.submitTransaction(recipientAddress, amount, "0x");
            await wallet.connect(addr1).confirmTransaction(0);
            await wallet.executeTransaction(0);

            // Check recipient received ETH
            const finalBalance = await ethers.provider.getBalance(recipientAddress);
            expect(finalBalance - initialBalance).to.equal(amount);
        });

        it("Should submit and execute token transaction", async function () {
            const amount = ethers.parseEther("10");
            const recipientAddress = await addr3.getAddress();
            const tokenAddress = await token.getAddress();

            // Submit token transaction
            await wallet.submitTokenTransaction(tokenAddress, recipientAddress, amount);
            await wallet.connect(addr1).confirmTransaction(0);
            await wallet.executeTransaction(0);

            // Check recipient received tokens
            expect(await token.balanceOf(recipientAddress)).to.equal(amount);
        });
    });

    describe("Delegation Management", function () {
        it("Should create and confirm token delegation", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();

            // Submit delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            
            // Confirm delegation with second signer
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Check delegation status
            const status = await wallet.getDelegationStatus(tokenAddress, delegateAddress);
            expect(status.isActive).to.be.true;
            expect(status.dailyLimit).to.equal(dailyLimit);
        });

        it("Should allow delegated token transfers within limit", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Setup delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Perform delegated transfer
            const transferAmount = ethers.parseEther("1.0");
            await wallet.connect(delegate).delegatedTransfer(
                tokenAddress,
                recipientAddress,
                transferAmount
            );

            // Check transfer succeeded
            expect(await token.balanceOf(recipientAddress)).to.equal(transferAmount);
        });

        it("Should enforce daily limits on delegated transfers", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Setup delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Attempt to transfer more than daily limit
            const transferAmount = dailyLimit + 1n;
            await expect(
                wallet.connect(delegate).delegatedTransfer(
                    tokenAddress,
                    recipientAddress,
                    transferAmount
                )
            ).to.be.revertedWith("exceeds daily limit");
        });

        it("Should revoke delegation", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Setup delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Revoke delegation
            await wallet.revokeDelegation(tokenAddress, delegateAddress);

            // Attempt transfer should fail
            const transferAmount = ethers.parseEther("1.0");
            await expect(
                wallet.connect(delegate).delegatedTransfer(
                    tokenAddress,
                    recipientAddress,
                    transferAmount
                )
            ).to.be.revertedWith("not authorized delegate");
        });
    });

    describe("ETH Delegation", function () {
        beforeEach(async function () {
            const walletAddress = await wallet.getAddress();
            // Fund the wallet with ETH
            await owner.sendTransaction({
                to: walletAddress,
                value: oneEther
            });
        });

        it("Should create and use ETH delegation", async function () {
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Create ETH delegation (address(0) represents ETH)
            await wallet.submitDelegation(ethers.ZeroAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(ethers.ZeroAddress, delegateAddress);

            // Perform delegated ETH transfer
            const transferAmount = ethers.parseEther("1.0");
            const initialBalance = await ethers.provider.getBalance(recipientAddress);

            await wallet.connect(delegate).delegatedTransfer(
                ethers.ZeroAddress,
                recipientAddress,
                transferAmount
            );

            const finalBalance = await ethers.provider.getBalance(recipientAddress);
            expect(finalBalance - initialBalance).to.equal(transferAmount);
        });
    });

    describe("Utility Functions", function () {
        it("Should return correct token balance", async function () {
            const tokenAddress = await token.getAddress();
            const balance = await wallet.getTokenBalance(tokenAddress);
            expect(balance).to.equal(tokenAmount / 2n);
        });

        it("Should return correct ETH balance", async function () {
            const walletAddress = await wallet.getAddress();
            await owner.sendTransaction({
                to: walletAddress,
                value: oneEther
            });
            const balance = await wallet.getTokenBalance(ethers.ZeroAddress);
            expect(balance).to.equal(oneEther);
        });

        it("Should return correct transaction count", async function () {
            const recipientAddress = await addr3.getAddress();
            await wallet.submitTransaction(recipientAddress, ethers.parseEther("0.5"), "0x");
            expect(await wallet.getTransactionCount()).to.equal(1n);
        });

        it("Should return list of signers", async function () {
            const walletSigners = await wallet.getSigners();
            const ownerAddress = await owner.getAddress();
            const addr1Address = await addr1.getAddress();
            const addr2Address = await addr2.getAddress();
            
            expect(walletSigners.length).to.equal(3);
            expect(walletSigners).to.include(ownerAddress);
            expect(walletSigners).to.include(addr1Address);
            expect(walletSigners).to.include(addr2Address);
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should not allow non-signers to submit transactions", async function () {
            const recipientAddress = await addr1.getAddress();
            await expect(
                wallet.connect(addr3).submitTransaction(recipientAddress, oneEther, "0x")
            ).to.be.revertedWith("not authorized signer");
        });

        it("Should not allow double confirmation", async function () {
            const recipientAddress = await addr3.getAddress();
            await wallet.submitTransaction(recipientAddress, oneEther, "0x");
            await expect(
                wallet.confirmTransaction(0)
            ).to.be.revertedWith("tx already confirmed");
        });

        it("Should not allow execution before enough confirmations", async function () {
            const recipientAddress = await addr3.getAddress();
            await wallet.submitTransaction(recipientAddress, oneEther, "0x");
            await expect(
                wallet.executeTransaction(0)
            ).to.be.revertedWith("cannot execute tx");
        });

        it("Should not allow delegates to exceed daily limit", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Setup delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Try to transfer just over daily limit
            const overLimit = dailyLimit + 1n;
            await expect(
                wallet.connect(delegate).delegatedTransfer(tokenAddress, recipientAddress, overLimit)
            ).to.be.revertedWith("exceeds daily limit");
        });

        it("Should reset daily limit after 24 hours", async function () {
            const tokenAddress = await token.getAddress();
            const delegateAddress = await delegate.getAddress();
            const recipientAddress = await addr3.getAddress();

            // Setup delegation
            await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
            await wallet.connect(addr1).confirmDelegation(tokenAddress, delegateAddress);

            // Make transfer at limit
            await wallet.connect(delegate).delegatedTransfer(
                tokenAddress,
                recipientAddress,
                dailyLimit
            );

            // Advance time by 24 hours
            await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            // Should be able to transfer again
            await wallet.connect(delegate).delegatedTransfer(
                tokenAddress,
                recipientAddress,
                dailyLimit
            );

            expect(await token.balanceOf(recipientAddress)).to.equal(dailyLimit * 2n);
        });
    });
});