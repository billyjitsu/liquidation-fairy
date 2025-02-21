export const MULTISIG_ABI = [
    {
        type: "function",
        name: "submitTransaction",
        inputs: [
            { type: "address", name: "to" },
            { type: "uint256", name: "value" },
            { type: "bytes", name: "data" },
        ],
        outputs: [{ type: "uint256" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "executeTransaction",
        inputs: [{ type: "uint256", name: "txIndex" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "getTransactionCount",
        inputs: [],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "transactions",
        inputs: [{ type: "uint256", name: "txIndex" }],
        outputs: [
            { type: "address", name: "to" },
            { type: "uint256", name: "value" },
            { type: "bytes", name: "data" },
            { type: "bool", name: "executed" },
            { type: "uint256", name: "numConfirmations" },
        ],
        stateMutability: "view",
    },
] as const;