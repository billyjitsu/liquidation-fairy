import { atomWithStorage } from 'jotai/utils'


export const multisigAddressAtom = atomWithStorage<string | undefined>(
    "multisigAddress", undefined
);
export const deployedAddressAtom = atomWithStorage<string | undefined>(
    "deployedAddress", undefined
);


