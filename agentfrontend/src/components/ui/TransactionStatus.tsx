import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface TransactionStatusProps {
  hash?: string;
  isLoading: boolean;
  isSuccess?: boolean;
  isError?: boolean;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  hash,
  isLoading,
  isSuccess,
  isError,
}) => {
  if (!hash) return null;

  return (
    <div className="mt-4 p-4 rounded-lg border">
      <div className="flex items-center space-x-2">
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        )}
        {isSuccess && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
        {isError && <XCircleIcon className="h-5 w-5 text-red-500" />}
        <a
          href={`https://testnet.soniclabs.com/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600"
        >
          View on Etherscan
        </a>
      </div>
    </div>
  );
};