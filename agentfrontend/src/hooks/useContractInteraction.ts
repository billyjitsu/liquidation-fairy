import { useState } from 'react';
import { useContractWrite, useWaitForTransaction } from 'wagmi';
import { toast } from 'react-hot-toast';

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

  const { write, data } = useContractWrite({
    address,
    abi,
    functionName,
  });

  const { isLoading } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: (data) => {
      toast.success('Transaction successful!');
      onSuccess?.(data);
      setIsPending(false);
    },
    onError: () => {
      toast.error('Transaction failed');
      setIsPending(false);
    },
  });

  const execute = async (...args: any[]) => {
    try {
      setIsPending(true);
      await write({ args });
    } catch (error) {
      toast.error('Failed to submit transaction');
      setIsPending(false);
    }
  };

  return {
    execute,
    isLoading: isLoading || isPending,
    data,
  };
}