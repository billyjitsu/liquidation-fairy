import { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useDeployContract,
} from "wagmi";
import { Card } from "../components/ui/card";
import { toast } from "react-hot-toast";
import multisigArtifact from "../contracts/abi.json";
import { storage } from "../utils/storage";
import { TransactionStatus } from "../components/TransactionStatus";

export default function DeployPage() {
  const { address } = useAccount();
  const [deployedAddress, setDeployedAddress] = useState<string>(
    storage.getMultisigAddress() || ""
  );

  const { deployContract, data: deployData } = useDeployContract({
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
      storage.setMultisigAddress(receipt.contractAddress);
      setDeployedAddress(receipt.contractAddress);
    }
  }, [receipt]);

  const handleDeploy = async () => {
    try {
      // Add your constructor arguments here if needed
      await deployContract({
        abi: multisigArtifact.abi,
        bytecode: `0x${multisigArtifact.bytecode.replace("0x", "")}`,
        args: [[address], 1],
      });
    } catch (error) {
      console.error("Deploy error:", error);
      toast.error("Failed to deploy contract");
    }
  };

  const handleReset = () => {
    storage.clearMultisigAddress();
    setDeployedAddress("");
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Deploy MultiSig Wallet</h2>

          <div className="space-y-4">
            {!address ? (
              <p className="text-yellow-600">
                Please connect your wallet first
              </p>
            ) : (
              <>
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isDeploying ? "Deploying..." : "Deploy MultiSig"}
                </button>

                {deployedAddress && (
                  <button
                    onClick={handleReset}
                    className="w-full mt-2 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                  >
                    Reset Deployed Contract
                  </button>
                )}
              </>
            )}

            {deployedAddress && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800">
                  Successfully Deployed!
                </h3>
                <p className="text-sm text-green-600 break-all">
                  Contract Address: {deployedAddress}
                </p>
              </div>
            )}
          </div>
        </div>
        <TransactionStatus
          hash={deployData}
          isLoading={isDeploying}
          isSuccess={!!receipt}
        />
      </Card>
    </div>
  );
}
