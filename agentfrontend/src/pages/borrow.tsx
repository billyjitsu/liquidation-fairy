import { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Card } from "../components/ui/Card";
import { parseUnits, encodeAbiParameters, keccak256 } from "viem";
import { toast } from "react-hot-toast";
import { TransactionStatus } from "../components/ui/TransactionStatus";
import { storage } from "../utils/storage";
import { createPublicClient, http, getContract } from "viem";
import { sonicTestnet } from "../wagmi";

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
    outputs: [{ type: "uint256" }],
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
  {
    type: "function",
    name: "transactions",
    inputs: [{ type: "uint256", name: "txIndex" }],
    outputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "bool", name: "executed" },
      { type: "uint256", name: "numConfirmations" },
    ],
    stateMutability: "view",
  },
] as const;

const publicClient = createPublicClient({
  chain: sonicTestnet,
  transport: http(sonicTestnet.rpcUrls.default.http[0]), // Use the specific RPC URL from your chain config
});

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
  const [delegatee, setDelegatee] = useState("");

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
      const getCount = async () => {
        try {
          const count = await publicClient.readContract({
            address: multisigAddress as `0x${string}`,
            abi: MULTISIG_ABI,
            functionName: "getTransactionCount",
          });

          const newTxIndex = Number(count) - 1;
          console.log("New Transaction Index:", {
            count: count.toString(),
            newTxIndex,
            multisigAddress,
          });
          setTxIndex(newTxIndex);
          setStep("execute");
          toast.success("Delegation submitted!");
        } catch (error) {
          console.error("Failed to get transaction count:", error);
          toast.error("Failed to get transaction index");
        }
      };

      getCount();
    }
  }, [submitReceipt, multisigAddress]);

  useEffect(() => {
    if (executeReceipt) {
      toast.success("Delegation executed!");
      setAmount("");
      setStep("submit");
    }
  }, [executeReceipt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress || !amount || !multisigAddress || !delegatee) {
      console.log("Submit Validation Failed:", {
        tokenAddress,
        amount,
        multisigAddress,
        delegatee,
      });
      return;
    }

    try {
      const parsedAmount = parseUnits(amount, decimals);
      console.log("Submitting Transaction:", {
        tokenAddress,
        delegatee,
        amount: parsedAmount.toString(),
        decimals,
      });

      // Define the full function signature including the name
      const functionSignature = "approveDelegation(address,uint256)";

      // Calculate the function selector (first 4 bytes of the keccak256 hash of the function signature)
      const functionSelector = `0x${keccak256(
        Buffer.from(functionSignature)
      ).slice(2, 10)}`;

      // Encode the parameters
      const encodedParams = encodeAbiParameters(
        [
          { name: "delegatee", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        [delegatee as `0x${string}`, parsedAmount]
      );

      // Combine the function selector with the encoded parameters
      const encodedData = `${functionSelector}${encodedParams.slice(2)}`;

      console.log("Encoded Data:", encodedData);

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

  const validateMultisigContract = async (address: string) => {
    try {
      const code = await publicClient.getBytecode({
        address: address as `0x${string}`,
      });
      if (!code || code === "0x") {
        return { valid: false, error: "No contract found at this address" };
      }
      return { valid: true };
    } catch (error) {
      console.error("Contract validation error:", error);
      return { valid: false, error: "Failed to validate contract" };
    }
  };

  const checkTransactionDetails = async (txIndex: number) => {
    try {
      if (!multisigAddress) {
        toast.error("Multisig address is required");
        return null;
      }

      const transaction = await publicClient.readContract({
        address: multisigAddress as `0x${string}`,
        abi: MULTISIG_ABI,
        functionName: "transactions",
        args: [BigInt(txIndex)],
      });

      if (!transaction) {
        toast.error("Transaction does not exist");
        return null;
      }

      // Instead of trying to read required confirmations, we'll use a fixed value or
      // assume transaction is executable if numConfirmations > 0
      return {
        to: transaction[0],
        value: transaction[1],
        data: transaction[2],
        executed: transaction[3],
        numConfirmations: transaction[4],
        requiredConfirmations: BigInt(1), // Assuming 1 confirmation is required
      };
    } catch (error) {
      console.error("Failed to check transaction details:", error);
      return null;
    }
  };

  const handleExecute = async () => {
    if (!txIndex) {
      toast.error("Missing transaction index");
      return;
    }

    try {
      console.log("Checking transaction:", {
        multisigAddress,
        txIndex,
      });

      const details = await checkTransactionDetails(txIndex);

      if (!details) {
        return;
      }

      console.log("Transaction details:", {
        ...details,
        numConfirmations: details.numConfirmations.toString(),
      });

      if (details.executed) {
        toast.error("Transaction has already been executed");
        return;
      }

      if (details.numConfirmations < BigInt(1)) {
        toast.error("Transaction needs at least 1 confirmation");
        return;
      }

      // Try to simulate the transaction first
      try {
        await publicClient.simulateContract({
          address: multisigAddress as `0x${string}`,
          abi: MULTISIG_ABI,
          functionName: "executeTransaction",
          args: [BigInt(txIndex)],
          account: address,
        });
      } catch (simulateError: any) {
        console.error("Simulation failed:", simulateError);
        toast.error(
          simulateError?.message?.includes("reason:")
            ? simulateError.message.split("reason:")[1].split("\n")[0].trim()
            : "Transaction simulation failed"
        );
        return;
      }

      // If simulation succeeds, execute the transaction
      await writeExecute({
        address: multisigAddress as `0x${string}`,
        abi: MULTISIG_ABI,
        functionName: "executeTransaction",
        args: [BigInt(txIndex)],
      });
    } catch (error: any) {
      console.error("Execute error:", {
        error,
        errorMessage: error?.message,
        txIndex,
        multisigAddress,
      });

      const errorMessage = error?.message || "Failed to execute delegation";
      toast.error(
        errorMessage.includes("reason:")
          ? errorMessage.split("reason:")[1].split("\n")[0].trim()
          : errorMessage
      );
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
              Delegate To (Address)
            </label>
            <input
              type="text"
              value={delegatee}
              onChange={(e) => setDelegatee(e.target.value)}
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
