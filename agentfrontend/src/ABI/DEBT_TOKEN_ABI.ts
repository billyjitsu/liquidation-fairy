export const DEBT_TOKEN_ABI = [
    {
        type: "function",
        name: "approveDelegation",
        inputs: [
            { type: "address", name: "delegatee" },
            { type: "uint256", name: "amount" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;