import Link from "next/link";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white shadow-md">
      <nav className="mt-5 px-2">
        <Link
          href="/"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md hover:bg-gray-50"
        >
          Home
        </Link>
        <Link
          href="/deploy"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md hover:bg-gray-50"
        >
          Deploy MultiSig
        </Link>
        <Link
          href="/delegate"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md hover:bg-gray-50"
        >
          Delegate Tokens
        </Link>
        <Link
          href="/transfer"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md hover:bg-gray-50"
        >
          Transfer Tokens
        </Link>
        <Link
          href="/borrow"
          className="group flex items-center px-2 py-2 text-base font-medium rounded-md hover:bg-gray-50"
        >
          Delegate Borrow
        </Link>
      </nav>
    </div>
  );
};

export default Sidebar;
