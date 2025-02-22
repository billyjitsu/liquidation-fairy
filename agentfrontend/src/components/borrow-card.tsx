import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { parseUnits, encodeFunctionData, TransactionReceipt } from "viem";
import { MULTISIG_ABI } from "@/ABI/MULTISIG_ABI";
import { DEBT_TOKEN_ABI } from "@/ABI/DEBT_TOKEN_ABI";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useExecuteTransaction } from "@/hooks/use-execute-transaction";
import { useEffect, useState } from "react";
import { multisigAddressAtom } from "@/stores/jotai-store";
import { useAtom } from "jotai";
import { TransactionStatus } from "./transaction-status";

interface DebtToken {
  readonly name: string;
  readonly address: `0x${string}`;
}

const decimals = 6;
const DEBT_TOKENS: DebtToken[] = [
  {
    name: "USDC Debt",
    address: "0xDBC8370B7bf5aCab88d6E39DD38Bcd57535D53a8",
  },
];

const borrowFormSchema = z.object({
  amount: z.string().min(1, { message: "Amount is required" }),
  multisigAddress: z
    .string()
    .min(1, { message: "Multisig address is required" }),
  delegatee: z.string().min(1, { message: "Delegatee address is required" }),
  debtTokenAddress: z.string(),
});

type BorrowFormData = z.infer<typeof borrowFormSchema>;

export default function BorrowCard() {
  const [multisigAddress, setMultisigAddress] = useAtom(multisigAddressAtom);
  const [executeHash, setExecuteHash] = useState<string | undefined>(undefined);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeReceipt, setExecuteReceipt] = useState<
    TransactionReceipt | undefined
  >(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting, isValid, isSubmitSuccessful },
  } = useForm({
    defaultValues: {
      multisigAddress: multisigAddress,
      debtTokenAddress: DEBT_TOKENS[0].address,
    },
    resolver: zodResolver(borrowFormSchema),
  });

  useEffect(() => {
    if (multisigAddress) {
      setValue("multisigAddress", multisigAddress);
    }
  }, [multisigAddress]);

  const { writeContractAsync: writeSubmit, data: submitHash } =
    useWriteContract();

  const { data: submitReceipt } = useWaitForTransactionReceipt({
    hash: submitHash,
  });

  const onSubmit = async (data: BorrowFormData) => {
    const { amount, multisigAddress, delegatee, debtTokenAddress } = data;

    try {
      const parsedAmount = parseUnits(amount, decimals);

      const encodedData = encodeFunctionData({
        abi: DEBT_TOKEN_ABI,
        functionName: "approveDelegation",
        args: [delegatee as `0x${string}`, parsedAmount],
      });

      await writeSubmit({
        address: multisigAddress as `0x${string}`,
        abi: MULTISIG_ABI,
        functionName: "submitTransaction",
        args: [debtTokenAddress as `0x${string}`, BigInt(0), encodedData],
      });

      setMultisigAddress(multisigAddress);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit delegation");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Delegate Borrow Allowance</CardTitle>
            <CardDescription className="mt-2">
              Enable borrowing capabilities by delegating debt token allowances
              through your MultiSig. Manage USDC borrowing permissions securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1">MultiSig Address</Label>
              <Input {...register("multisigAddress")} />
            </div>
            <div>
              <Label className="mb-1">Delegate To (Address)</Label>
              <Input {...register("delegatee")} />
            </div>
            <div>
              <Label className="mb-1">Debt Token</Label>
              <Select
                defaultValue={DEBT_TOKENS[0].address}
                onValueChange={(value) => {
                  setValue("debtTokenAddress", value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a debt token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DEBT_TOKENS.map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1">Amount</Label>
              <Input
                min={0}
                type="number"
                {...register("amount")}
                placeholder="0.0"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isSubmitting || !isValid || isSubmitSuccessful}
            >
              {isSubmitting ? "Submitting..." : "Submit Delegation"}
            </Button>
            <ExecutionButton
              isDisabled={!isSubmitSuccessful || !submitReceipt}
              setExecuteHash={setExecuteHash}
              setIsExecuting={setIsExecuting}
              setExecuteReceipt={setExecuteReceipt}
            />
          </CardFooter>
        </Card>
      </form>
      <TransactionStatus
        hash={!isSubmitSuccessful ? submitHash : executeHash}
        isLoading={!isSubmitSuccessful ? isSubmitting : isExecuting}
        isSuccess={!!submitReceipt || !!executeReceipt}
      />
    </div>
  );
}

interface ExecutionButtonProps {
  isDisabled: boolean;
  setExecuteHash: (hash: string | undefined) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setExecuteReceipt: (receipt: TransactionReceipt | undefined) => void;
}

const ExecutionButton = ({
  isDisabled,
  setExecuteHash,
  setIsExecuting,
  setExecuteReceipt,
}: ExecutionButtonProps) => {
  const { address } = useAccount();
  const [multisigAddress] = useAtom(multisigAddressAtom);
  const { writeContractAsync: writeExecute, data: executeHash } =
    useWriteContract();

  const { isPending: isExecuting, mutateAsync: executeTransaction } =
    useExecuteTransaction({
      contractWriter: writeExecute,
    });

  const { data: executeReceipt } = useWaitForTransactionReceipt({
    hash: executeHash,
  });

  useEffect(() => {
    if (executeHash) {
      setExecuteHash(executeHash);
    }
  }, [executeHash]);

  useEffect(() => {
    if (executeReceipt) {
      toast.success("Delegation executed successfully");
      setExecuteReceipt(executeReceipt);
    }
  }, [executeReceipt]);

  return (
    <Button
      type="button"
      className="w-full"
      variant="secondary"
      onClick={async () => {
        if (!multisigAddress) {
          toast.error("No multisig address found");
          return;
        }

        setIsExecuting(true);
        await executeTransaction({
          multisigAddress: multisigAddress,
          userAddress: address as `0x${string}`,
        });
        setIsExecuting(false);
      }}
      disabled={!address || isDisabled}
    >
      {isExecuting ? "Executing..." : "Execute Delegation"}
    </Button>
  );
};
