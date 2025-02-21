import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";
import {
  Card,
  CardDescription,
  CardTitle,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>DeFi Agent System</title>
        <meta
          content="Automated DeFi investment management system"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-9">
        <PageHeader />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Instructions />
        </div>
        <SecurityFeatures />
      </main>
      <div className="text-center py-8 text-gray-600">
        <p>Secure DeFi automation powered by smart contracts</p>
      </div>
    </div>
  );
};

export default Home;

const PageHeader = () => {
  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">DeFi Agent System</h1>
      </div>
      <p className="text-md text-gray-700">
        Welcome to our DeFi Agent System - a secure and automated solution for
        managing your DeFi investments through smart contract delegation.
      </p>
    </>
  );
};

const Instructions = () => {
  const STEPS = [
    {
      title: "Setup Instructions",
      description:
        "Setup your MultiSig wallet and delegate access to the AI agent. This enables the agent to trade and manage positions within your specified limits. Monitor performance and adjust settings anytime.",
      link: "/setup",
      subSteps: [
        {
          title: "1. Deploy MultiSig",
          description:
            "Deploy your personal MultiSig wallet. This creates a secure contract that will hold and manage your funds with additional safety measures.",
        },
        {
          title: "3. Delegate Access",
          description:
            "Set up delegation permissions for the AI agent. This allows automated trading within your specified daily limits while maintaining security.",
        },
        {
          title: "4. Delegate Borrowing",
          description:
            "Enable borrowing capabilities by delegating debt token allowances through your MultiSig. Manage USDC borrowing permissions securely.",
        },
      ],
      cta: "Setup",
    },
    {
      title: "Transfer Tokens",
      description:
        "Transfer your tokens (API3, USDC) to the MultiSig wallet. This is the first step in allowing the agent to manage your investments.",
      link: "/transfer",
      cta: "Transfer Tokens",
    },
  ];

  return (
    <>
      {STEPS.map((step) => (
        <Card key={step.link} className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>{step.title}</CardTitle>
            <CardDescription className="mt-2">
              {step.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex-grow">
            {step.subSteps?.map((subStep) => (
              <div key={subStep.title}>
                <h3 className="text-lg font-semibold">{subStep.title}</h3>
                <p className="text-sm text-gray-600">{subStep.description}</p>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button className="w-full !text-white" asChild>
              <Link href={step.cta}>{step.cta} →</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </>
  );
};

const SecurityFeatures = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Features</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc list-inside space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <li>MultiSig wallet protection</li>
          <li>Daily transaction limits</li>
          <li>Revocable delegations</li>
          <li>Transparent on-chain operations</li>
          <li>Secure borrowing permissions</li>
          <li>Multi-step transaction approval</li>
        </ul>
      </CardContent>
    </Card>
  );
};
