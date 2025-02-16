import { useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "../components/ui/Card";
import { parseUnits } from "viem";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { TransactionStatus } from "../components/ui/TransactionStatus";

const TOKEN_OPTIONS = [
  { name: "USDC", address: process.env.NEXT_PUBLIC_USDC_ADDRESS, decimals: 6 },
  { name: "WETH", address: process.env.NEXT_PUBLIC_WETH_ADDRESS, decimals: 18 },
];

export default function TransferPage() {
  const { address } = useAccount();
  const [selectedToken, setSelectedToken] = useState(TOKEN_OPTIONS[0]);
  const [amount, setAmount] = useState("");

  const {
    execute: transfer,
    isLoading: isTransferring,
    data: transferData,
  } = useContractInteraction({
    address: selectedToken.address as `0x${string}`,
    abi: ["function transfer(address to, uint256 amount) returns (bool)"],
    functionName: "transfer",
    onSuccess: () => {
      setAmount("");
    },
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const parsedAmount = parseUnits(amount, selectedToken.decimals);
    await transfer(process.env.NEXT_PUBLIC_MULTISIG_ADDRESS, parsedAmount);
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
              Select Token
            </label>
            <select
              value={selectedToken.name}
              onChange={(e) =>
                setSelectedToken(
                  TOKEN_OPTIONS.find((t) => t.name === e.target.value) ||
                    TOKEN_OPTIONS[0]
                )
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {TOKEN_OPTIONS.map((token) => (
                <option key={token.address} value={token.name}>
                  {token.name}
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
            disabled={!address || isTransferring}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isTransferring ? "Transferring..." : "Transfer"}
          </button>
        </form>
        <TransactionStatus
          hash={transferData?.hash}
          isLoading={isTransferring}
          isSuccess={!!transferData?.hash}
        />
      </Card>
    </div>
  );
}
