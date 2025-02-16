import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { Card } from '../components/ui/Card';
import { parseEther, parseUnits } from 'viem';

export default function DelegatePage() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [decimals, setDecimals] = useState(18);

  const { write: submitDelegation, data: delegationData } = useContractWrite({
    address: process.env.NEXT_PUBLIC_MULTISIG_ADDRESS as `0x${string}`,
    abi: [
      "function submitDelegation(address token, address delegate, uint256 dailyLimit) external",
    ],
    functionName: 'submitDelegation',
  });

  const { isLoading: isDelegating } = useWaitForTransaction({
    hash: delegationData?.hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress || !delegateAddress || !amount) return;

    const parsedAmount = parseUnits(amount, decimals);
    submitDelegation({
      args: [tokenAddress, delegateAddress, parsedAmount],
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-2xl font-bold mb-6">Delegate Tokens</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700">Token Address</label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Delegate Address</label>
            <input
              type="text"
              value={delegateAddress}
              onChange={(e) => setDelegateAddress(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.0"
            />
          </div>

          <button
            type="submit"
            disabled={!address || isDelegating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isDelegating ? 'Delegating...' : 'Submit Delegation'}
          </button>
        </form>
      </Card>
    </div>
  );
}