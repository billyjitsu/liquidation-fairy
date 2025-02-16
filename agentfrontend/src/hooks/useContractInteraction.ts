import { useState } from "react";
import { useWriteContract, useWaitForTransaction } from "wagmi";
import { toast } from "react-hot-toast";

interface UseContractInteractionProps {
  address: `0x${string}`;
  abi: any[];
  functionName: string;
  onSuccess?: (data: any) => void;
}

export function useContractInteraction({
  address,
  abi,
  functionName,
  onSuccess,
}: UseContractInteractionProps) {
  const [isPending, setIsPending] = useState(false);

  const { writeContract, data } = useWriteContract({
    mutation: {
      onSuccess: (data) => {
        onSuccess?.(data);
        setIsPending(false);
      },
      onError: () => {
        toast.error("Transaction failed");
        setIsPending(false);
      },
    },
  });

  const { isLoading } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      toast.success("Transaction successful!");
    },
  });

  const execute = async (...args: any[]) => {
    try {
      setIsPending(true);
      await writeContract({
        address,
        abi,
        functionName,
        args,
      });
    } catch (error) {
      toast.error("Failed to submit transaction");
      setIsPending(false);
    }
  };

  return {
    execute,
    isLoading: isLoading || isPending,
    data,
  };
}
