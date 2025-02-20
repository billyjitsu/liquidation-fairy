import { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Card } from "../components/ui/card";
import { parseUnits } from "viem";
import { toast } from "react-hot-toast";
import { TransactionStatus } from "../components/TransactionStatus";
import { storage } from "../utils/storage";

const SUPPORTED_TOKENS = {
  API3: {
    address: "0x1afBD344C4eBFD0671EAdC1eAeF25DA4De61b3EE",
    decimals: 18,
  },
  USDC: {
    address: "0x289138602a9C41a176EfBb7e8EE62D9942dF0D0F",
    decimals: 6,
  },
} as const;

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function TransferPage() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [multisigAddress, setMultisigAddress] = useState(
    storage.getMultisigAddress()
  );

  const handleMultisigAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newAddress = e.target.value;
    setMultisigAddress(newAddress);
    storage.setMultisigAddress(newAddress);
  };

  const { writeContract, data: hash } = useWriteContract({
    mutation: {
      onSuccess: (data) => {
        toast.success("Transfer submitted!");
      },
      onError: (error) => {
        toast.error("Failed to submit transfer");
        console.error("Transfer error:", error);
      },
    },
  });

  const { isLoading: isTransferring, data: receipt } =
    useWaitForTransactionReceipt({
      hash,
    });

  useEffect(() => {
    if (receipt) {
      toast.success("Transfer confirmed!");
      setAmount("");
    }
  }, [receipt]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress || !amount || !multisigAddress) return;

    try {
      const parsedAmount = parseUnits(amount, decimals);
      await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [multisigAddress as `0x${string}`, parsedAmount],
      });
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("Failed to submit transfer");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <form onSubmit={handleTransfer} className="p-6 space-y-4">
          <h2 className="text-2xl font-bold mb-6">
            Transfer Tokens to MultiSig
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              MultiSig Address
            </label>
            <input
              type="text"
              value={multisigAddress || ""}
              onChange={handleMultisigAddressChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0x..."
            />
          </div>

          {!multisigAddress && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <p className="text-yellow-700">
                No MultiSig contract address found. Please deploy a contract
                first.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Token
            </label>
            <select
              value={tokenAddress}
              onChange={(e) => {
                const selected = e.target.value;
                const selectedToken = Object.values(SUPPORTED_TOKENS).find(
                  (token) => token.address === selected
                );

                if (selectedToken) {
                  setTokenAddress(selected);
                  setDecimals(selectedToken.decimals);
                } else {
                  setTokenAddress("");
                  setDecimals(18);
                }
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a token</option>
              {Object.entries(SUPPORTED_TOKENS).map(([name, token]) => (
                <option key={token.address} value={token.address}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.0"
            />
          </div>

          <button
            type="submit"
            disabled={
              !address || isTransferring || !multisigAddress || !tokenAddress
            }
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {!multisigAddress
              ? "Deploy MultiSig First"
              : isTransferring
              ? "Transferring..."
              : "Transfer"}
          </button>
        </form>
        <TransactionStatus
          hash={hash}
          isLoading={isTransferring}
          isSuccess={!!receipt}
        />
      </Card>
    </div>
  );
}
