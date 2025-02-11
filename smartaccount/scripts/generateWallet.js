const ethers = require('ethers');

function generateWallet() {
    // Generate a random wallet
    const wallet = ethers.Wallet.createRandom();
    
    console.log("\n=== New Ethereum Wallet Generated ===\n");
    console.log(`Address: ${wallet.address}`);
    console.log(`Private Key: ${wallet.privateKey}`);
    
    // Get the mnemonic phrase
    // const mnemonic = wallet.mnemonic;
    // console.log(`\nMnemonic Phrase: ${mnemonic.phrase}`);
    
    // Warning message
    console.log("\n⚠️  IMPORTANT: Save these credentials securely!");
    console.log("Never share your private key or mnemonic phrase with anyone!");
}

// Execute the wallet generation
try {
    generateWallet();
} catch (error) {
    console.error("Error generating wallet:", error);
}