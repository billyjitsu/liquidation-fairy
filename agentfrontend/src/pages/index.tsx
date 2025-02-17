import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>DeFi Agent System</title>
        <meta
          content="Automated DeFi investment management system"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">DeFi Agent System</h1>
          {/* <ConnectButton /> */}
        </div>

        <div className="prose lg:prose-xl mb-12">
          <p className="text-xl text-gray-700">
            Welcome to our DeFi Agent System - a secure and automated solution
            for managing your DeFi investments through smart contract
            delegation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-blue-600 mb-3">
              1. Deploy MultiSig
            </h2>
            <p className="text-gray-600 mb-4">
              Start by deploying your personal MultiSig wallet. This creates a
              secure contract that will hold and manage your funds with
              additional safety measures.
            </p>
            <Link
              href="/deploy"
              className="text-blue-500 hover:text-blue-700 font-medium"
            >
              Deploy MultiSig →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-green-600 mb-3">
              2. Transfer Tokens
            </h2>
            <p className="text-gray-600 mb-4">
              Transfer your tokens (API3, USDC) to the MultiSig wallet. This is
              the first step in allowing the agent to manage your investments.
            </p>
            <Link
              href="/transfer"
              className="text-green-500 hover:text-green-700 font-medium"
            >
              Transfer Funds →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-purple-600 mb-3">
              3. Delegate Access
            </h2>
            <p className="text-gray-600 mb-4">
              Set up delegation permissions for the AI agent. This allows
              automated trading within your specified daily limits while
              maintaining security.
            </p>
            <Link
              href="/delegate"
              className="text-purple-500 hover:text-purple-700 font-medium"
            >
              Set Up Delegation →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-amber-600 mb-3">
              4. Delegate Borrowing
            </h2>
            <p className="text-gray-600 mb-4">
              Enable borrowing capabilities by delegating debt token allowances
              through your MultiSig. Manage USDC borrowing permissions securely.
            </p>
            <Link
              href="/borrow"
              className="text-amber-500 hover:text-amber-700 font-medium"
            >
              Setup Borrowing →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 md:col-span-2">
            <h2 className="text-xl font-semibold text-orange-600 mb-3">
              Security Features
            </h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <li>MultiSig wallet protection</li>
              <li>Daily transaction limits</li>
              <li>Revocable delegations</li>
              <li>Transparent on-chain operations</li>
              <li>Secure borrowing permissions</li>
              <li>Multi-step transaction approval</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-700">
            <li>Deploy your personal MultiSig wallet contract</li>
            <li>Transfer your tokens to the MultiSig wallet</li>
            <li>Set up delegation permissions for the AI agent</li>
            <li>Configure borrowing allowances if needed</li>
            <li>
              The agent can now trade and manage positions within your specified
              limits
            </li>
            <li>Monitor performance and adjust settings anytime</li>
          </ol>
        </div>
      </main>

      <footer className="text-center py-8 text-gray-600">
        <p>Secure DeFi automation powered by smart contracts</p>
      </footer>
    </div>
  );
};

export default Home;
