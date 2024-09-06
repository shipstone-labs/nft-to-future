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
import TimeMachine from "./TimeMachine";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Props = {};
type Result = {
  done: boolean;
  result: {
    message: [string, string, LitAccessControlConditionResource[]];
    date: number;
    jsonUrl: string;
    jsonData: string;
    pngUrl: string;
    frameUrl: string;
  };
};

export function LitConnection({ children }: PropsWithChildren<Props>) {
  const [sessionSigsMap, setSessionSigsMap] = useState<SessionSigsMap | null>();
  const [result, setResult] = useState<Result>();
  const [sending, setSending] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>();
  const signer = useSignMessage();
  const wallet = useAccount();
  const [showTimeMachine, setShowTimeMachine] = useState(false);

  const onSend = useCallback(
    async (message: string, date: Date) => {
      setTargetDate(date);
      setSending(true);
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
                    statement:
                      "I agree to allow LITProtocol to encrypt my message(s) for the future until this session expires.",
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
            setResult(output);
            setSending(false);
            litNodeClient.disconnect();
            break;
          } catch (error) {
            // Try again if login was previously persisted but possibly expired.
            _sessionSignatures = null;
            setSessionSigsMap(null);
          }
        }
      } catch (error) {
        setSending(false);
        console.error("Failed to connect to Lit Network:", error);
      }
    },
    [signer, wallet, sessionSigsMap]
  );

  const onReset = useCallback(() => {
    setResult(undefined);
    setShowTimeMachine(false);
    setTargetDate(undefined);
  }, []);

  const onMint = useCallback(() => {}, []);
  const onCast = useCallback(() => {}, []);
  const onTweet = useCallback(() => {}, []);
  if (!wallet.isConnected) {
    return (
      <>
        <h1 className="text-center">
          Please connect a wallet on base with some funds to be able to mint
          your NFT to the future with a personalized message to be made public
          at a future date and time.
        </h1>
      </>
    );
  }
  return (
    <>
      {showTimeMachine ? (
        <TimeMachine targetDate={targetDate} imageUrl={result?.result?.pngUrl}>
          <div className="flex flex-row justify-center space-x-4 mt-4">
            {result?.result?.jsonData ? (
              <button
                type="button"
                disabled={sending}
                onClick={onMint}
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Mint
              </button>
            ) : null}
            {result?.result?.frameUrl ? (
              <button
                type="button"
                disabled={sending}
                onClick={onCast}
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cast
              </button>
            ) : null}
            {result?.result?.frameUrl ? (
              <button
                type="button"
                disabled={sending}
                onClick={onTweet}
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Tweet
              </button>
            ) : null}
            <button
              type="button"
              disabled={sending}
              onClick={onReset}
              className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Send Another
            </button>
          </div>
        </TimeMachine>
      ) : (
        <MessageForm
          onSend={onSend}
          sending={sending}
          onNextView={() => setShowTimeMachine(true)}
        />
      )}
    </>
  );
}
