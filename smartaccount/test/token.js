const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  let wallet;
  let token;
  let mockContract;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let delegate;
  let signers;

  const oneEther = ethers.parseEther("1.0");
  const tokenAmount = ethers.parseEther("1000.0");
  const dailyLimit = ethers.parseEther("10.0");

  // Helper function to move forward in time
  async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, addr3, delegate] = await ethers.getSigners();

    // Convert signer objects to addresses for the constructor
    signers = [
      await owner.getAddress(),
      await addr1.getAddress(),
      await addr2.getAddress(),
    ];

    // Deploy MultiSigWallet
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    wallet = await MultiSigWallet.deploy(signers, 2n); // Requires 2 confirmations
    await wallet.waitForDeployment();

    // Deploy Mock ERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock Token", "MTK", tokenAmount);
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
        value: oneEther,
      });
      const balance = await ethers.provider.getBalance(walletAddress);
      expect(balance).to.equal(oneEther);
    });
  });

  describe("Function Encoding Examples", function () {
    it("Should encode and execute ERC20 approve function", async function () {
      const tokenAddress = await token.getAddress();
      const spenderAddress = await addr3.getAddress();
      const amount = ethers.parseEther("10");

      // Method 1: Using contract interface
      const approveData = token.interface.encodeFunctionData("approve", [
        spenderAddress,
        amount,
      ]);

      // Submit and execute transaction
      await wallet.submitTransaction(tokenAddress, 0, approveData);
      await wallet.connect(addr1).confirmTransaction(0);
      await wallet.executeTransaction(0);

      // Verify approval
      expect(
        await token.allowance(await wallet.getAddress(), spenderAddress)
      ).to.equal(amount);
    });

    it("Should encode and execute ERC20 transfer using direct ABI encoding", async function () {
      const tokenAddress = await token.getAddress();
      const recipientAddress = await addr3.getAddress();
      const amount = ethers.parseEther("10");

      // Method 2: Using direct ABI encoding
      const transferSelector = ethers
        .id("transfer(address,uint256)")
        .slice(0, 10);
      const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [recipientAddress, amount]
      );
      const transferData = transferSelector + encodedParams.slice(2); // remove 0x prefix from params

      // Submit and execute transaction
      await wallet.submitTransaction(tokenAddress, 0, transferData);
      await wallet.connect(addr1).confirmTransaction(0);
      await wallet.executeTransaction(0);

      // Verify transfer
      expect(await token.balanceOf(recipientAddress)).to.equal(amount);
    });

    xit("Should encode and execute multiple function parameters", async function () {
      const tokenAddress = await token.getAddress();
      const recipientAddress = await addr3.getAddress();
      const spenderAddress = await addr2.getAddress();
      const amount = ethers.parseEther("10");

      // First approve spender
      const approveData = token.interface.encodeFunctionData("approve", [
        spenderAddress,
        amount,
      ]);

      await wallet.submitTransaction(tokenAddress, 0, approveData);
      await wallet.connect(addr1).confirmTransaction(0);
      await wallet.executeTransaction(0);

      // Get wallet address before encoding
      const walletAddress = await wallet.getAddress();

      // Then do transferFrom
      const transferFromData = token.interface.encodeFunctionData(
        "transferFrom",
        [walletAddress, recipientAddress, amount]
      );

      // Submit the transaction from the approved spender
      await wallet
        .connect(addr2)
        .submitTransaction(tokenAddress, 0, transferFromData);
      await wallet.connect(addr1).confirmTransaction(1);
      await wallet.executeTransaction(1);

      expect(await token.balanceOf(recipientAddress)).to.equal(amount);
    });

    it("Should encode and execute batch approvals", async function () {
      const tokenAddress = await token.getAddress();
      const spenders = [
        await addr1.getAddress(),
        await addr2.getAddress(),
        await addr3.getAddress(),
      ];
      const amounts = [
        ethers.parseEther("10"),
        ethers.parseEther("20"),
        ethers.parseEther("30"),
      ];

      // Submit multiple approval transactions
      for (let i = 0; i < spenders.length; i++) {
        const approveData = token.interface.encodeFunctionData("approve", [
          spenders[i],
          amounts[i],
        ]);

        await wallet.submitTransaction(tokenAddress, 0, approveData);
        await wallet.connect(addr1).confirmTransaction(i);
        await wallet.executeTransaction(i);
      }

      // Verify all approvals
      for (let i = 0; i < spenders.length; i++) {
        expect(
          await token.allowance(await wallet.getAddress(), spenders[i])
        ).to.equal(amounts[i]);
      }
    });
  });

  describe("Transaction Management", function () {
    it("Should submit and confirm ETH transaction", async function () {
      const walletAddress = await wallet.getAddress();
      // First fund the wallet
      await owner.sendTransaction({
        to: walletAddress,
        value: oneEther,
      });

      // Submit transaction
      const recipientAddress = await addr3.getAddress();
      await wallet.submitTransaction(
        recipientAddress,
        ethers.parseEther("0.5"),
        "0x"
      );

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
        value: oneEther,
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
      await wallet.submitTokenTransaction(
        tokenAddress,
        recipientAddress,
        amount
      );
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
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegateAddress);

      // Check delegation status
      const status = await wallet.getDelegationStatus(
        tokenAddress,
        delegateAddress
      );
      expect(status.isActive).to.be.true;
      expect(status.dailyLimit).to.equal(dailyLimit);
    });

    it("Should allow delegated token transfers within limit", async function () {
      const tokenAddress = await token.getAddress();
      const delegateAddress = await delegate.getAddress();
      const recipientAddress = await addr3.getAddress();

      // Setup delegation
      await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegateAddress);

      // Perform delegated transfer
      const transferAmount = ethers.parseEther("1.0");
      await wallet
        .connect(delegate)
        .delegatedTransfer(tokenAddress, recipientAddress, transferAmount);

      // Check transfer succeeded
      expect(await token.balanceOf(recipientAddress)).to.equal(transferAmount);
    });

    it("Should enforce daily limits on delegated transfers", async function () {
      const tokenAddress = await token.getAddress();
      const delegateAddress = await delegate.getAddress();
      const recipientAddress = await addr3.getAddress();

      // Setup delegation
      await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegateAddress);

      // Attempt to transfer more than daily limit
      const transferAmount = dailyLimit + 1n;
      await expect(
        wallet
          .connect(delegate)
          .delegatedTransfer(tokenAddress, recipientAddress, transferAmount)
      ).to.be.revertedWith("exceeds daily limit");
    });

    it("Should revoke delegation", async function () {
      const tokenAddress = await token.getAddress();
      const delegateAddress = await delegate.getAddress();
      const recipientAddress = await addr3.getAddress();

      // Setup delegation
      await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegateAddress);

      // Revoke delegation
      await wallet.revokeDelegation(tokenAddress, delegateAddress);

      // Attempt transfer should fail
      const transferAmount = ethers.parseEther("1.0");
      await expect(
        wallet
          .connect(delegate)
          .delegatedTransfer(tokenAddress, recipientAddress, transferAmount)
      ).to.be.revertedWith("not authorized delegate");
    });
  });

  describe("ETH Delegation", function () {
    beforeEach(async function () {
      const walletAddress = await wallet.getAddress();
      // Fund the wallet with ETH
      await owner.sendTransaction({
        to: walletAddress,
        value: oneEther,
      });
    });

    it("Should create and use ETH delegation", async function () {
      const delegateAddress = await delegate.getAddress();
      const recipientAddress = await addr3.getAddress();

      // Create ETH delegation (address(0) represents ETH)
      await wallet.submitDelegation(
        ethers.ZeroAddress,
        delegateAddress,
        dailyLimit
      );
      await wallet
        .connect(addr1)
        .confirmDelegation(ethers.ZeroAddress, delegateAddress);

      // Perform delegated ETH transfer
      const transferAmount = ethers.parseEther("1.0");
      const initialBalance = await ethers.provider.getBalance(recipientAddress);

      await wallet
        .connect(delegate)
        .delegatedTransfer(
          ethers.ZeroAddress,
          recipientAddress,
          transferAmount
        );

      const finalBalance = await ethers.provider.getBalance(recipientAddress);
      expect(finalBalance - initialBalance).to.equal(transferAmount);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should not allow non-signers to submit transactions", async function () {
      const recipientAddress = await addr1.getAddress();
      await expect(
        wallet
          .connect(addr3)
          .submitTransaction(recipientAddress, oneEther, "0x")
      ).to.be.revertedWith("not authorized signer");
    });

    it("Should not allow double confirmation", async function () {
      const recipientAddress = await addr3.getAddress();
      await wallet.submitTransaction(recipientAddress, oneEther, "0x");
      await expect(wallet.confirmTransaction(0)).to.be.revertedWith(
        "tx already confirmed"
      );
    });

    it("Should not allow execution before enough confirmations", async function () {
      const recipientAddress = await addr3.getAddress();
      await wallet.submitTransaction(recipientAddress, oneEther, "0x");
      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "cannot execute tx"
      );
    });

    it("Should reset daily limit after 24 hours", async function () {
      const tokenAddress = await token.getAddress();
      const delegateAddress = await delegate.getAddress();
      const recipientAddress = await addr3.getAddress();

      // Setup delegation
      await wallet.submitDelegation(tokenAddress, delegateAddress, dailyLimit);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegateAddress);

      // Make transfer at limit
      await wallet
        .connect(delegate)
        .delegatedTransfer(tokenAddress, recipientAddress, dailyLimit);

      // Advance time by 24 hours
      await increaseTime(24 * 60 * 60);

      // Should be able to transfer again
      await wallet
        .connect(delegate)
        .delegatedTransfer(tokenAddress, recipientAddress, dailyLimit);

      expect(await token.balanceOf(recipientAddress)).to.equal(dailyLimit * 2n);
    });

    it("Should handle multiple delegates with different limits", async function () {
      const tokenAddress = await token.getAddress();
      const delegate1Address = await delegate.getAddress();
      const delegate2Address = await addr3.getAddress();
      const recipientAddress = await addr2.getAddress();

      // Setup different limits for different delegates
      const limit1 = ethers.parseEther("5.0");
      const limit2 = ethers.parseEther("3.0");

      // Setup first delegation
      await wallet.submitDelegation(tokenAddress, delegate1Address, limit1);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegate1Address);

      // Setup second delegation
      await wallet.submitDelegation(tokenAddress, delegate2Address, limit2);
      await wallet
        .connect(addr1)
        .confirmDelegation(tokenAddress, delegate2Address);

      // Both delegates should be able to transfer within their limits
      await wallet
        .connect(delegate)
        .delegatedTransfer(tokenAddress, recipientAddress, limit1);

      await wallet
        .connect(addr3)
        .delegatedTransfer(tokenAddress, recipientAddress, limit2);

      expect(await token.balanceOf(recipientAddress)).to.equal(limit1 + limit2);
    });

    it("Should fail delegation if daily limit is zero", async function () {
      const tokenAddress = await token.getAddress();
      const delegateAddress = await delegate.getAddress();

      await expect(
        wallet.submitDelegation(tokenAddress, delegateAddress, 0)
      ).to.be.revertedWith("invalid daily limit");
    });

    it("Should fail delegation to zero address", async function () {
      const tokenAddress = await token.getAddress();

      await expect(
        wallet.submitDelegation(tokenAddress, ethers.ZeroAddress, dailyLimit)
      ).to.be.revertedWith("invalid delegate address");
    });
  });
});
