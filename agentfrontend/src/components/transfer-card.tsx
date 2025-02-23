import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseUnits } from "viem";
import { toast } from "react-hot-toast";
import { TransactionStatus } from "../components/transaction-status";
import { multisigAddressAtom } from "@/stores/jotai-store";
import { useAtom } from "jotai";
import { z } from "zod";
import { ERC20_ABI } from "@/ABI/ERC_20_ABI";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectGroup,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";

const SUPPORTED_TOKENS = [
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

const transferFormSchema = z.object({
  tokenAddress: z.string(),
  amount: z.string().min(0.01, { message: "Amount must be greater than 0" }),
  multisigAddress: z.string(),
});

type TransferFormData = z.infer<typeof transferFormSchema>;

export default function TransferCard() {
  const [multisigAddress, setMultisigAddress] = useAtom(multisigAddressAtom);

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
    resolver: zodResolver(transferFormSchema),
  });

  const { writeContractAsync, data: hash } = useWriteContract({
    mutation: {
      onSuccess: () => {
        toast.success("Transfer submitted!");
      },
      onError: (error) => {
        toast.error("Failed to submit transfer");
        console.error("Transfer error:", error);
      },
    },
  });

  const { isLoading: isTransferring, data: receipt } =
    useWaitForTransactionReceipt({
      hash,
    });

  useEffect(() => {
    if (multisigAddress) setValue("multisigAddress", multisigAddress);
  }, [multisigAddress]);

  useEffect(() => {
    if (receipt) toast.success("Transfer confirmed!");
  }, [receipt]);

  const onSubmit = async ({
    tokenAddress,
    amount,
    multisigAddress,
  }: TransferFormData) => {
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
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [multisigAddress as `0x${string}`, parsedAmount],
      });

      setMultisigAddress(multisigAddress);
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error("Failed to submit transfer");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transfer Tokens to MultiSig</CardTitle>
          <CardDescription className="mt-2">
            Transfer your tokens (API3, USDC) to the MultiSig wallet. This is
            the first step in allowing the agent to manage your investments.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2">MultiSig Address</Label>
              <Input
                type="text"
                placeholder="0x..."
                {...register("multisigAddress")}
              />
            </div>
            {!multisigAddress && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 mt-3">
                <p className="text-yellow-700">
                  No MultiSig contract address found. Please deploy a contract
                  first.
                </p>
              </div>
            )}
            <div>
              <Label className="mb-2">Select Token</Label>
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
              <Label className="mb-2">Amount</Label>
              <Input
                step={0.1}
                min={0}
                type="number"
                placeholder="0.0"
                {...register("amount")}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !isValid}
            >
              {!multisigAddress
                ? "Deploy MultiSig First"
                : isTransferring
                ? "Transferring..."
                : "Transfer"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <TransactionStatus
        hash={hash}
        isLoading={isTransferring}
        isSuccess={!!receipt}
      />
    </>
  );
}
