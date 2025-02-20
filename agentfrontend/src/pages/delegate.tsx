import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Card } from "../components/ui/card";
import { parseUnits, formatUnits } from "viem";
import { toast } from "react-hot-toast";
import { storage } from "../utils/storage";
import { TransactionStatus } from "../components/TransactionStatus";

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

type DelegationStatus = [
  bigint, // dailyLimit
  bigint, // spentToday
  bigint, // remainingToday
  bigint, // timeUntilReset
  bigint, // confirmations
  boolean // isActive
];

export default function DelegatePage() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState("");
  const [delegateAddress, setDelegateAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [multisigAddress, setMultisigAddress] = useState(
    storage.getMultisigAddress()
  );
  const [delegationStatus, setDelegationStatus] =
    useState<DelegationStatus | null>(null);

  const { writeContract, data: hash } = useWriteContract({
    mutation: {
      onSuccess: (data) => {
        toast.success("Delegation submitted!");
      },
      onError: (error) => {
        toast.error("Failed to submit delegation");
        console.error("Delegation error:", error);
      },
    },
  });

  const { isLoading: isDelegating, data: receipt } =
    useWaitForTransactionReceipt({
      hash,
    });

  const { data: status } = useReadContract({
    address: multisigAddress as `0x${string}`,
    abi: [
      {
        type: "function",
        name: "getDelegationStatus",
        inputs: [
          { type: "address", name: "_token" },
          { type: "address", name: "_delegate" },
        ],
        outputs: [
          { type: "uint256", name: "dailyLimit" },
          { type: "uint256", name: "spentToday" },
          { type: "uint256", name: "remainingToday" },
          { type: "uint256", name: "timeUntilReset" },
          { type: "uint256", name: "confirmations" },
          { type: "bool", name: "isActive" },
        ],
        stateMutability: "view",
      },
    ],
    functionName: "getDelegationStatus",
    args: [tokenAddress as `0x${string}`, delegateAddress as `0x${string}`],
    query: {
      enabled: Boolean(tokenAddress && delegateAddress && multisigAddress),
      refetchInterval: 1000, // Refetch every second
    },
  });

  useEffect(() => {
    if (receipt) {
      toast.success("Delegation confirmed!");
      // Reset form
      setTokenAddress("");
      setDelegateAddress("");
      setAmount("");
    }
  }, [receipt]);

  useEffect(() => {
    if (status) {
      setDelegationStatus(status as DelegationStatus);
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress || !delegateAddress || !amount) return;

    try {
      const parsedAmount = parseUnits(amount, decimals);
      await writeContract({
        address: multisigAddress as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "submitDelegation",
            inputs: [
              { type: "address", name: "token" },
              { type: "address", name: "delegate" },
              { type: "uint256", name: "dailyLimit" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "submitDelegation",
        args: [
          tokenAddress as `0x${string}`,
          delegateAddress as `0x${string}`,
          parsedAmount,
        ],
      });
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit delegation");
    }
  };

  // Add handler for multisig address changes
  const handleMultisigAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newAddress = e.target.value;
    setMultisigAddress(newAddress);
    storage.setMultisigAddress(newAddress);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-2xl font-bold mb-6">Delegate Tokens</h2>

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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Token
            </label>
            <select
              value={tokenAddress}
              onChange={(e) => {
                const selected = e.target.value;
                const selectedToken = Object.values(SUPPORTED_TOKENS).find(
                  (token) => token.address === selected
                );

                // Batch the state updates together
                if (selectedToken) {
                  setTokenAddress(selected);
                  setDecimals(selectedToken.decimals);
                } else {
                  setTokenAddress("");
                  setDecimals(18); // Reset to default
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
              Delegate Address
            </label>
            <input
              type="text"
              value={delegateAddress}
              onChange={(e) => setDelegateAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0x..."
            />
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

          {delegationStatus && (
            <div className="p-4 bg-gray-100 rounded-md">
              <h3 className="text-lg font-semibold mb-2">Delegation Status</h3>
              <p>Daily Limit: {formatUnits(delegationStatus[0], decimals)}</p>
              <p>Spent Today: {formatUnits(delegationStatus[1], decimals)}</p>
              <p>
                Remaining Today: {formatUnits(delegationStatus[2], decimals)}
              </p>
              <p>Time Until Reset: {delegationStatus[3].toString()} seconds</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!address || isDelegating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isDelegating ? "Delegating..." : "Submit Delegation"}
          </button>
        </form>
        <TransactionStatus
          hash={hash}
          isLoading={isDelegating}
          isSuccess={!!receipt}
        />
      </Card>
    </div>
  );
}
