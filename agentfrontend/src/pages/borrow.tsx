import { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Card } from "../components/ui/Card";
import { parseUnits, encodeAbiParameters } from "viem";
import { toast } from "react-hot-toast";
import { TransactionStatus } from "../components/ui/TransactionStatus";
import { storage } from "../utils/storage";

const DEBT_TOKENS = {
  "USDC Debt": {
    address: "0xDBC8370B7bf5aCab88d6E39DD38Bcd57535D53a8",
    decimals: 6,
  },
} as const;

const MULTISIG_ABI = [
  {
    type: "function",
    name: "submitTransaction",
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeTransaction",
    inputs: [{ type: "uint256", name: "txIndex" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTransactionCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export default function BorrowPage() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [txIndex, setTxIndex] = useState<number | null>(null);
  const [step, setStep] = useState<"submit" | "execute">("submit");
  const [multisigAddress, setMultisigAddress] = useState(
    storage.getMultisigAddress()
  );

  const { writeContract: writeSubmit, data: submitHash } = useWriteContract();
  const { writeContract: writeExecute, data: executeHash } = useWriteContract();

  const { isLoading: isSubmitting, data: submitReceipt } =
    useWaitForTransactionReceipt({
      hash: submitHash,
    });

  const { isLoading: isExecuting, data: executeReceipt } =
    useWaitForTransactionReceipt({
      hash: executeHash,
    });

  useEffect(() => {
    if (submitReceipt) {
      toast.success("Delegation submitted!");
      setStep("execute");
    }
  }, [submitReceipt]);

  useEffect(() => {
    if (executeReceipt) {
      toast.success("Delegation executed!");
      setAmount("");
      setStep("submit");
    }
  }, [executeReceipt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress || !amount || !multisigAddress) return;

    try {
      const parsedAmount = parseUnits(amount, decimals);
      const approveData = {
        name: "approveDelegation",
        type: "function",
        inputs: [
          { name: "delegatee", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };

      const encodedData = encodeAbiParameters(approveData.inputs, [
        "0x62394a362ba1BbD5125dD39e42bEa8B984b303B8",
        parsedAmount,
      ]);

      await writeSubmit({
        address: multisigAddress as `0x${string}`,
        abi: MULTISIG_ABI,
        functionName: "submitTransaction",
        args: [
          tokenAddress as `0x${string}`,
          BigInt(0),
          encodedData as `0x${string}`,
        ],
      });
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit delegation");
    }
  };

  const handleExecute = async () => {
    if (!txIndex) return;

    try {
      await writeExecute({
        address: multisigAddress as `0x${string}`,
        abi: MULTISIG_ABI,
        functionName: "executeTransaction",
        args: [BigInt(txIndex)],
      });
    } catch (error) {
      console.error("Execute error:", error);
      toast.error("Failed to execute delegation");
    }
  };

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
          <h2 className="text-2xl font-bold mb-6">Delegate Borrow Allowance</h2>

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
              Debt Token
            </label>
            <select
              value={tokenAddress}
              onChange={(e) => {
                const selected = e.target.value;
                const selectedToken = Object.values(DEBT_TOKENS).find(
                  (token) => token.address === selected
                );

                if (selectedToken) {
                  setTokenAddress(selected);
                  setDecimals(selectedToken.decimals);
                } else {
                  setTokenAddress("");
                  setDecimals(6);
                }
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select a token</option>
              {Object.entries(DEBT_TOKENS).map(([name, token]) => (
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

          {step === "submit" ? (
            <button
              type="submit"
              disabled={!address || isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? "Submitting..." : "Submit Delegation"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecute}
              disabled={!address || isExecuting}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {isExecuting ? "Executing..." : "Execute Delegation"}
            </button>
          )}
        </form>
        <TransactionStatus
          hash={step === "submit" ? submitHash : executeHash}
          isLoading={step === "submit" ? isSubmitting : isExecuting}
          isSuccess={!!submitReceipt || !!executeReceipt}
        />
      </Card>
    </div>
  );
}
