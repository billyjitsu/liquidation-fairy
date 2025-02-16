import { useState } from 'react';
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi';
import { Card } from '../components/ui/Card';

export default function DeployPage() {
  const { address } = useAccount();
  const [deployedAddress, setDeployedAddress] = useState<string>('');

  const { write: deployMultisig, data: deployData } = useContractWrite({
    // Add your contract config here
    functionName: 'deploy',
  });

  const { isLoading: isDeploying } = useWaitForTransaction({
    hash: deployData?.hash,
    onSuccess(data) {
      // Handle successful deployment
      setDeployedAddress(data.contractAddress);
    },
  });

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Deploy MultiSig Wallet</h2>
          
          <div className="space-y-4">
            {!address ? (
              <p className="text-yellow-600">Please connect your wallet first</p>
            ) : (
              <button
                onClick={() => deployMultisig()}
                disabled={isDeploying}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isDeploying ? 'Deploying...' : 'Deploy MultiSig'}
              </button>
            )}

            {deployedAddress && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800">Successfully Deployed!</h3>
                <p className="text-sm text-green-600 break-all">
                  Contract Address: {deployedAddress}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}