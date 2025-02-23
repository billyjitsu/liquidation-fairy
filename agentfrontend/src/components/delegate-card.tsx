import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardFooter,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "react-hot-toast";
import { TransactionStatus } from "../components/transaction-status";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAtom } from "jotai";
import { multisigAddressAtom } from "@/stores/jotai-store";

interface SUPPORTED_TOKENS {
  readonly name: string;
  readonly address: `0x${string}`;
  readonly decimals: number;
}

const SUPPORTED_TOKENS: SUPPORTED_TOKENS[] = [
  {
    name: "API3",
    address: "0x1afBD344C4eBFD0671EAdC1eAeF25DA4De61b3EE",
    decimals: 18,
  },
  {
    name: "USDC",
    address: "0x289138602a9C41a176EfBb7e8EE62D9942dF0D0F",
    decimals: 6,
  },
];

type DelegationStatus = [
  bigint, // dailyLimit
  bigint, // spentToday
  bigint, // remainingToday
  bigint, // timeUntilReset
  bigint, // confirmations
  boolean // isActive
];

const delegateFormSchema = z.object({
  multisigAddress: z.string(),
  tokenAddress: z.string(),
  delegateAddress: z.string(),
  amount: z.string().min(1, { message: "Amount is required" }),
});

type DelegateFormData = z.infer<typeof delegateFormSchema>;

export default function DelegateCard() {
  const { address } = useAccount();
  const [multisigAddress, setMultisigAddress] = useAtom(multisigAddressAtom);
  const [tokenAddress, setTokenAddress] = useState<string | undefined>(
    undefined
  );
  const [delegateAddress, setDelegateAddress] = useState<string | undefined>(
    undefined
  );
  const [decimals, setDecimals] = useState<number>(6);
  const [delegationStatus, setDelegationStatus] =
    useState<DelegationStatus | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting, isValid, errors },
  } = useForm({
    defaultValues: {
      tokenAddress: SUPPORTED_TOKENS[0].address,
      multisigAddress: multisigAddress,
    },
    resolver: zodResolver(delegateFormSchema),
  });

  const { writeContractAsync, data: hash } = useWriteContract({
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

  const onSubmit = async ({
    tokenAddress,
    delegateAddress,
    amount,
  }: DelegateFormData) => {
    const decimals = SUPPORTED_TOKENS.find(
      (token) => token.address === tokenAddress
    )?.decimals;

    if (!decimals) {
      toast.error("Invalid token address");
      return;
    }

    try {
      const parsedAmount = parseUnits(amount, decimals);
      await writeContractAsync({
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

      setTokenAddress(tokenAddress);
      setDelegateAddress(delegateAddress);
      setMultisigAddress(multisigAddress);
      setDecimals(decimals);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit delegation");
    }
  };

  useEffect(() => {
    if (multisigAddress) {
      setValue("multisigAddress", multisigAddress);
    }
    if (tokenAddress) {
      setValue("tokenAddress", tokenAddress);
    }
    if (delegateAddress) {
      setValue("delegateAddress", delegateAddress);
    }
  }, [multisigAddress, tokenAddress, delegateAddress]);

  useEffect(() => {
    if (receipt) {
      toast.success("Delegation confirmed!");
      setTokenAddress(undefined);
      setDelegateAddress(undefined);
    }
  }, [receipt]);

  useEffect(() => {
    if (status) setDelegationStatus(status as DelegationStatus);
  }, [status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delegate Tokens</CardTitle>
        <CardDescription className="mt-2">
          Set up delegation permissions for the AI agent. This allows automated
          trading within your specified daily limits while maintaining security.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <CardContent>
          <div>
            <Label className="mb-1">MultiSig Address</Label>
            <Input
              type="text"
              placeholder="0x..."
              {...register("multisigAddress")}
            />
          </div>
          <div>
            <Label className="mb-1">Token</Label>
            <Select
              defaultValue={SUPPORTED_TOKENS[0].address}
              onValueChange={(value) => {
                setValue("tokenAddress", value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a debt token" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SUPPORTED_TOKENS.map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1">Delegate Address</Label>
            <Input
              type="text"
              placeholder="0x..."
              {...register("delegateAddress")}
            />
          </div>
          <div>
            <Label className="mb-1">Amount</Label>
            <Input type="number" placeholder="0.0" {...register("amount")} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full cursor-pointer"
            type="submit"
            disabled={!address || isSubmitting || !isValid}
          >
            {isSubmitting ? "Delegating..." : "Submit Delegation"}
          </Button>
          <TransactionStatus
            hash={hash}
            isLoading={isDelegating}
            isSuccess={!!receipt}
          />
          {delegationStatus && (
            <div className="p-4 mt-4 bg-gray-100 rounded-md w-full">
              <h3 className="text-lg font-semibold mb-2">Delegation Status</h3>
              <p>Daily Limit: {formatUnits(delegationStatus[0], decimals)}</p>
              <p>Spent Today: {formatUnits(delegationStatus[1], decimals)}</p>
              <p>
                Remaining Today: {formatUnits(delegationStatus[2], decimals)}
              </p>
              <p>Time Until Reset: {delegationStatus[3].toString()} seconds</p>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
