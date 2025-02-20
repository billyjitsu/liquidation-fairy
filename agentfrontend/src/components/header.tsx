import { ConnectButton } from "@rainbow-me/rainbowkit";

export const Navbar = () => {
  return (
    <section className="px-4 py-3">
      <div className="mx-auto">
        <nav className="justify-between items-center flex">
          <h1 className="text-xl font-bold">Liquidation Fairy Manager</h1>
          <ConnectButton />
        </nav>
      </div>
    </section>
  );
};
