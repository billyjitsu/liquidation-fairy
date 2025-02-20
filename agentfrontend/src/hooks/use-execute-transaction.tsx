import { useMutation } from "@tanstack/react-query";
import { WriteContractMutateAsync } from "wagmi/query";
import { Config } from "wagmi";
import { MULTISIG_ABI } from "@/ABI/MULTISIG_ABI";
import { publicClient } from "@/wagmi";
import { useCheckTransactionDetails } from "@/hooks/use-get-transaction-details";
import toast from "react-hot-toast";

interface ExecuteTransactionArgs {
  multisigAddress: string;
  userAddress: `0x${string}`;
}

interface ExecuteTransactionProps {
  contractWriter: WriteContractMutateAsync<Config, unknown>;
}

export const useExecuteTransaction = ({
  contractWriter,
}: ExecuteTransactionProps) => {
  return useMutation({
    mutationFn: async ({
      multisigAddress,
      userAddress,
    }: ExecuteTransactionArgs) => {
      const txIndex = await getTransactionIndex(multisigAddress);

      try {
        await simulateExecute({
          multisigAddress,
          userAddress,
          txIndex,
        });
      } catch (error: any) {
        toast.error(error.message);
        return;
      }

      try {
        await contractWriter({
          address: multisigAddress as `0x${string}`,
          abi: MULTISIG_ABI,
          functionName: "executeTransaction",
          args: [BigInt(txIndex)],
        });
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to execute delegation";
        toast.error(
          errorMessage.includes("reason:")
            ? errorMessage.split("reason:")[1].split("\n")[0].trim()
            : errorMessage
        );
      }
    },
  });
};

interface ExecuteProps {
  multisigAddress: string;
  userAddress: `0x${string}`;
  txIndex: number;
}

const simulateExecute = async ({
  multisigAddress,
  userAddress,
  txIndex,
}: ExecuteProps) => {
  const details = await useCheckTransactionDetails({
    multisigAddress,
    txIndex,
  });

  if (!details) {
    toast.error("Transaction does not exist");
    throw new Error("Transaction does not exist");
  }

  if (details.executed) {
    toast.error("Transaction has already been executed");
    throw new Error("Transaction has already been executed");
  }

  if (details.numConfirmations < BigInt(1)) {
    toast.error("Transaction needs at least 1 confirmation");
    throw new Error("Transaction needs at least 1 confirmation");
  }

  try {
    await publicClient.simulateContract({
      address: multisigAddress as `0x${string}`,
      abi: MULTISIG_ABI,
      functionName: "executeTransaction",
      args: [BigInt(txIndex)],
      account: userAddress,
    });
  } catch (simulateError: any) {
    console.error("Simulation failed:", simulateError);
    toast.error(
      simulateError?.message?.includes("reason:")
        ? simulateError.message.split("reason:")[1].split("\n")[0].trim()
        : "Transaction simulation failed"
    );
    throw new Error("Transaction simulation failed");
  }
};

const getTransactionIndex = async (multisigAddress: string) => {
  const count = await publicClient.readContract({
    address: multisigAddress as `0x${string}`,
    abi: MULTISIG_ABI,
    functionName: "getTransactionCount",
  });

  const countNumber = Number(count);

  return countNumber - 1;
};
