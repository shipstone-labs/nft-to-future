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
import { useAccount, useAccountEffect, useSignMessage } from "wagmi";
import type { SignableMessage } from "viem";
import { type PropsWithChildren, useCallback, useState } from "react";
import { MessageForm } from "./MessageForm";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Props = {};

export function LitConnection({ children }: PropsWithChildren<Props>) {
  const [connected, setConnected] = useState<SessionSigsMap | null>(null);
  const [sessionSigsMap, setSessionSigsMap] = useState<SessionSigsMap | null>();
  const signer = useSignMessage();
  const wallet = useAccount();
  const onSend = useCallback(
    async (message: string, date: Date) => {
      console.log("Message:", message);
      console.log("Publish Date:", date);
      try {
        // More information about the available Lit Networks: https://developer.litprotocol.com/category/networks
        const litNodeClient = new LitNodeClient({
          litNetwork: LitNetwork.DatilDev,
          debug: false,
        });

        await litNodeClient.connect();
        console.log("Connected to Lit Network");

        let _sessionSignatures = sessionSigsMap;
        for (let i = 0; i < 2; i++) {
          try {
            if (!_sessionSignatures) {
              _sessionSignatures = await litNodeClient.getSessionSigs({
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
                    walletAddress: wallet?.address as string,
                    nonce: await litNodeClient.getLatestBlockhash(),
                    litNodeClient,
                  });

                  return await generateAuthSig({
                    signer: {
                      signMessage: async (message: string | Bytes) =>
                        signer.signMessageAsync({
                          message: message as SignableMessage,
                        }),
                      getAddress: async () => wallet?.address as string,
                    },
                    toSign,
                  });
                },
              });
              setSessionSigsMap(_sessionSignatures);
            }

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
              { conditionType: "operator", operator: "or" },
              {
                conditionType: "evmBasic",
                contractAddress: "",
                standardContractType: "timestamp",
                chain: "base",
                method: "eth_getBlockByNumber",
                parameters: ["latest"],
                returnValueTest: {
                  comparator: ">=",
                  value: Math.round(date.getTime() / 1000).toString(),
                },
              },
            ];

            const { ciphertext, dataToEncryptHash } =
              await litNodeClient.encrypt({
                unifiedAccessControlConditions,
                dataToEncrypt: new TextEncoder().encode(message),
              });
            const input = [
              ciphertext,
              dataToEncryptHash,
              unifiedAccessControlConditions,
            ];
            const request = {
              message: input,
              address: wallet.address,
              date: date.getTime(),
            };
            const output = await fetch("/api/request", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(request),
            }).then((res) => {
              if (!res.ok) {
                throw new Error(res.statusText);
              }
              return res.json();
            });
            console.log("Result", output);
            break;
          } catch (error) {
            // Try again if login was previously persisted but possibly expired.
            _sessionSignatures = null;
            setSessionSigsMap(null);
          }
        }
      } catch (error) {
        console.error("Failed to connect to Lit Network:", error);
      }
    },
    [signer, wallet, sessionSigsMap]
  );
  if (!wallet.isConnected) {
    return (
      <>
        <h1>
          Please connect a wallet on base with some funds to be able to mint
          your NFT to the future with a personalized message to be made public
          at a future date and time.
        </h1>
      </>
    );
  }
  return (
    <>
      <MessageForm onSend={onSend} />
    </>
  );
}
