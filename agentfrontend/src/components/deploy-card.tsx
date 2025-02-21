import { multisigAddressAtom } from "@/stores/jotai-store";
import { TransactionStatus } from "./transaction-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useAtom } from "jotai";
import {
  useAccount,
  useDeployContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useEffect } from "react";
import toast from "react-hot-toast";
import multisigArtifact from "../contracts/abi.json";
import { Button } from "./ui/button";

export default function DeployCard() {
  const { address } = useAccount();
  const [multisigAddress, setMultisigAddress] = useAtom(multisigAddressAtom);

  const { deployContractAsync, data: deployData } = useDeployContract({
    mutation: {
      onSuccess: () => {
        toast.success("Contract deployment initiated!");
      },
      onError: (error) => {
        toast.error("Failed to deploy contract");
        console.error("Deploy error:", error);
      },
    },
  });

  const { isLoading: isDeploying, data: receipt } =
    useWaitForTransactionReceipt({
      hash: deployData,
    });

  useEffect(() => {
    if (receipt?.contractAddress) {
      setMultisigAddress(receipt.contractAddress);
    }
  }, [receipt]);

  const handleDeploy = async () => {
    try {
      await deployContractAsync({
        abi: multisigArtifact.abi,
        bytecode: `0x${multisigArtifact.bytecode.replace("0x", "")}`,
        args: [[address], 1],
      });
    } catch (error) {
      console.error("Deploy error:", error);
      toast.error("Failed to deploy contract");
    }
  };

  return (
    <>
      <Card className="space-y-4">
        <CardHeader>
          <CardTitle>Deploy MultiSig Wallet</CardTitle>
          <CardDescription className="mt-2">
            {!address
              ? "Please connect your wallet first"
              : "Start by deploying your personal MultiSig wallet. This creates a secure contract that will hold and manage your funds with additional safety measures."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {multisigAddress ? (
              <>
                <Button onClick={() => setMultisigAddress(undefined)}>
                  Reset Deployed Contract
                </Button>

                <div className="mt-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800">
                    Successfully Deployed!
                  </h3>
                  <p className="text-sm text-green-600 break-all">
                    Contract Address: {multisigAddress}
                  </p>
                </div>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={handleDeploy}
                disabled={isDeploying}
              >
                {isDeploying ? "Deploying..." : "Deploy MultiSig"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <TransactionStatus
        hash={deployData}
        isLoading={isDeploying}
        isSuccess={!!receipt}
      />
    </>
  );
}
