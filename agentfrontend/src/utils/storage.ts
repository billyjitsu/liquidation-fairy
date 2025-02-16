export const storage = {
  getMultisigAddress: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('multisigAddress') || '';
  },
  setMultisigAddress: (address: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('multisigAddress', address);
  },
  clearMultisigAddress: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("multisigAddress");
  }
};