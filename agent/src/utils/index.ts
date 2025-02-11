export function extractEthereumAddress(text: string) {
    const ethAddressPattern = /\b0x[a-fA-F0-9]{40}\b/g;
    const matches = text.match(ethAddressPattern);
    return matches?.[0];
}


