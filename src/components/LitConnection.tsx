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
import {
  useAccount,
  useAccountEffect,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import type { AbiItem, SignableMessage } from "viem";
import {
  type MouseEvent,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
    external_url: string;
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
  const [remoteAddress, setRemoteAddress] = useState<string>();
  const isCompose =
    typeof document !== "undefined"
      ? document.location.search.includes("compose")
      : false;
  const [minted, setMinted] = useState<string | null | undefined>();
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const text = useMemo(
    () =>
      `I sent a message to the future to be visible at ${targetDate?.toUTCString()}.`,
    [targetDate]
  );

  useEffect(() => {
    if (!remoteAddress) {
      fetch("/api/request")
        .then((res) => res.json())
        .then(({ address }) => {
          setRemoteAddress(address);
        });
    }
  }, [remoteAddress]);

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
                  value: remoteAddress, // "0x7E07149c5E924FBD5fa9e82E7e49b078c1e230E6",
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
    [signer, wallet, sessionSigsMap, remoteAddress]
  );

  const onReset = useCallback(() => {
    setResult(undefined);
    setShowTimeMachine(false);
    setTargetDate(undefined);
  }, []);

  const { writeContractAsync } = useWriteContract();
  const onMint = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!wallet?.address) {
        return;
      }
      if (minted === "pending") return;
      if (minted) {
        window.open(minted, "_blank");
        return;
      }
      const abi: AbiItem[] = [
        {
          inputs: [
            {
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "amount",
              type: "uint256",
            },
            {
              internalType: "bytes",
              name: "data",
              type: "bytes",
            },
          ],
          name: "mint",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
      ];
      // const value: bigint = read.data != null ? read.data : 0n;
      // await writeContractAsync(
      //   {
      //     address: "0x9d4DAaA689C4bF686Af64A9727bE6682F98dC78e",
      //     account: wallet.data?.account?.address,
      //     args: [wallet.data?.account?.address, 1, image?.jsonUrl],
      //     abi,
      //     value,
      //     functionName: "mint",
      //     // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      //   } as any,
      //   {
      //     onSuccess: (transaction) => {
      //       setTransactionHash(transaction);
      //     },
      //     onError: (...args) => {
      //       console.log("error", args);
      //       setMinted(null);
      //     },
      //   }
      // );
      // setMinted("pending");
    },
    [minted, wallet]
  );

  const onCast = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isCompose) {
        window.parent.postMessage(
          {
            type: "createCast",
            data: {
              cast: {
                text,
                embeds: [result?.result?.frameUrl],
              },
            },
          },
          "*"
        );
      } else {
        window.open(
          `https://warpcast.com/~/compose?embeds[]=${
            result?.result?.frameUrl
          }&text=${encodeURIComponent(text)}`,
          "_blank"
        );
      }
    },
    [isCompose, result, text]
  );
  const onTweet = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      window.open(
        `https://x.com/intent/tweet?url=${
          result?.result?.frameUrl
        }&text=${encodeURIComponent(text)}`,
        "_blank"
      );
    },
    [result, text]
  );

  if (!wallet.isConnected || !remoteAddress) {
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
            {result?.result?.external_url ? (
              <a
                href={result?.result?.external_url}
                target="_blank"
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
                rel="noreferrer"
              >
                Read
              </a>
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
          <div className="whitespace-pre font-sans text-base overflow-scroll p-4 w-full">
            {JSON.stringify(result?.result, null, 2)}
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
