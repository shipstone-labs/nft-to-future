import type { Bytes } from "@ethersproject/bytes";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import type { SessionSigsMap } from "@lit-protocol/types";
import { LitNetwork } from "@lit-protocol/constants";
import {
  LitAbility,
  LitAccessControlConditionResource,
  createSiweMessage,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { useAccountEffect, useSignMessage } from "wagmi";
import type { SignableMessage } from "viem";
import { type PropsWithChildren, useState } from "react";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Props = {};

export function LitConnection({ children }: PropsWithChildren<Props>) {
  const [connected, setConnected] = useState<SessionSigsMap | null>(null);

  const signer = useSignMessage();
  useAccountEffect({
    onConnect: async (data) => {
      try {
        // More information about the available Lit Networks: https://developer.litprotocol.com/category/networks
        const litNodeClient = new LitNodeClient({
          litNetwork: LitNetwork.DatilDev,
          debug: false,
        });

        await litNodeClient.connect();
        console.log("Connected to Lit Network");

        const sessionSignatures = await litNodeClient.getSessionSigs({
          chain: "base",
          expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
          capabilityAuthSigs: [], // Unnecessary on datil-dev
          resourceAbilityRequests: [
            {
              resource: new LitAccessControlConditionResource("*"),
              ability: LitAbility.AccessControlConditionDecryption,
            },
          ],
          authNeededCallback: async ({
            uri,
            expiration,
            resourceAbilityRequests,
          }) => {
            const toSign = await createSiweMessage({
              uri,
              expiration,
              resources: resourceAbilityRequests,
              walletAddress: data?.address,
              nonce: await litNodeClient.getLatestBlockhash(),
              litNodeClient,
            });

            return await generateAuthSig({
              signer: {
                signMessage: async (message: string | Bytes) =>
                  signer.signMessageAsync({
                    message: message as SignableMessage,
                  }),
                getAddress: async () => data?.address as string,
              },
              toSign,
            });
          },
        });

        const unifiedAccessControlConditions = [
          {
            conditionType: "evmBasic",
            contractAddress: "",
            standardContractType: "",
            chain: "base",
            method: "",
            parameters: [":userAddress"],
            returnValueTest: {
              comparator: "=",
              value: "0x7E07149c5E924FBD5fa9e82E7e49b078c1e230E6",
            },
          },
          { operator: "or" },
          {
            conditionType: "operator",
            operator: "0x7E07149c5E924FBD5fa9e82E7e49b078c1e230E6",
          },
          {
            contractAddress: "",
            standardContractType: "timestamp",
            chain: "base",
            method: "eth_getBlockByNumber",
            parameters: ["latest"],
            returnValueTest: {
              comparator: ">=",
              value: (Date.now() / 1000).toString(),
            },
          },
        ];

        // encrypt
        const { ciphertext, dataToEncryptHash } = await litNodeClient.encrypt({
          unifiedAccessControlConditions,
          dataToEncrypt: new TextEncoder().encode("this is a secret message"),
        });
        console.log(
          "Encrypted",
          "this is a secret message",
          "=>",
          ciphertext,
          dataToEncryptHash
        );

        const { decryptedData } = await litNodeClient.decrypt({
          unifiedAccessControlConditions,
          sessionSigs: sessionSignatures,
          ciphertext,
          dataToEncryptHash,
          chain: "base",
        });

        console.log(
          "Decrypted",
          decryptedData,
          new TextDecoder().decode(decryptedData)
        );
        setConnected(sessionSignatures);
      } catch (error) {
        console.error("Failed to connect to Lit Network:", error);
      }
    },
    onDisconnect: () => {
      setConnected(null);
    },
  });
  if (connected) {
    return (
      <>
        <pre>{JSON.stringify(connected, null, 2)}</pre>
        {children}
      </>
    );
  }
  return null;
}
