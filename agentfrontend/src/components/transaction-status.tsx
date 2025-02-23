import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { Button } from "./ui/button";
import Link from "next/link";

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
    <Button className="cursor-pointer w-full mt-2" variant="ghost" asChild>
      <Link
        href={`https://testnet.sonicscan.org/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        )}
        {isSuccess && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
        {isError && <XCircleIcon className="h-5 w-5 text-red-500" />}
        View on Sonicscan
      </Link>
    </Button>
  );
};
