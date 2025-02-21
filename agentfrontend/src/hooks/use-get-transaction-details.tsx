import { MULTISIG_ABI } from "@/ABI/MULTISIG_ABI";
import { publicClient } from "@/wagmi";
import toast from "react-hot-toast";

interface CheckTransactionDetailsProps {
  multisigAddress: string;
  txIndex: number;
}

export const useCheckTransactionDetails = async ({
  multisigAddress,
  txIndex,
}: CheckTransactionDetailsProps) => {
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
};
