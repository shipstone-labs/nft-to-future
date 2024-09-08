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
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  decodeEventLog,
  verifyMessage,
  type AbiItem,
  type SignableMessage,
} from "viem";
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
import { usePlausible } from "next-plausible";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
type Props = {};
type Result = {
  done: boolean;
  result: {
    message: [string, string, LitAccessControlConditionResource[]];
    date: number;
    jsonUrl: string;
    jsonData: string;
    jsonSignature: string;
    pngUrl: string;
    frameUrl: string;
    external_url: string;
  };
};

export function LitConnection({ children }: PropsWithChildren<Props>) {
  const [sessionSigsMap, setSessionSigsMap] = useState<SessionSigsMap | null>();
  const [result, setResult] = useState<Result>();
  const [sending, setSending] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>();
  const plausible = usePlausible();
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
          plausible("RemoteAddress");
          setRemoteAddress(address);
        });
    }
  }, [remoteAddress, plausible]);

  const onSend = useCallback(
    async (message: string, date: Date) => {
      setTargetDate(date);
      setSending(true);
      try {
        plausible("Sending");
        // More information about the available Lit Networks: https://developer.litprotocol.com/category/networks
        const litNodeClient = new LitNodeClient({
          litNetwork: LitNetwork.DatilDev,
          debug: false,
        });

        await litNodeClient.connect();

        let _sessionSignatures = sessionSigsMap;
        // biome-ignore lint/correctness/noUnreachable: <explanation>
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
                      "I agree to allow https://nft-to-the-future.shipstone.com to use LITProtocol to encrypt my message(s) for the future until this session expires.",
                    resources: resourceAbilityRequests,
                    walletAddress: wallet?.address as string,
                    nonce: await litNodeClient.getLatestBlockhash(),
                    litNodeClient,
                    domain: document.location.hostname,
                    // "nft-to-the-future.shipstone.com",
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
              plausible("Signed");
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
            setTransmitting(true);
            plausible("Encrypted");
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
            plausible("Generated");
            setResult(output);
            setSending(false);
            setTransmitting(false);
            litNodeClient.disconnect();
            break;
          } catch (error) {
            // Try again if login was previously persisted but possibly expired.
            _sessionSignatures = null;
            setSessionSigsMap(null);
            throw error;
          }
        }
      } catch (error) {
        setSending(false);
        setTransmitting(false);
        console.error("Failed to connect to Lit Network:", error);
      }
    },
    [signer, wallet, sessionSigsMap, remoteAddress, plausible]
  );

  const onReset = useCallback(() => {
    setResult(undefined);
    setShowTimeMachine(false);
    setTargetDate(undefined);
  }, []);

  const { writeContractAsync } = useWriteContract();
  useEffect(() => {
    const doMint = async () => {
      if (
        !wallet?.address ||
        !result?.result?.jsonData ||
        !result?.result?.jsonSignature
      ) {
        return;
      }
      if (minted) return;
      const abi: AbiItem[] = [
        {
          inputs: [
            {
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              internalType: "bytes",
              name: "data",
              type: "bytes",
            },
            {
              internalType: "bytes",
              name: "signature",
              type: "bytes",
            },
          ],
          name: "mint",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ];
      setMinted("pending");
      plausible("Minting");
      await writeContractAsync(
        {
          address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS,
          account: wallet.address,
          args: [
            wallet.address,
            result?.result?.jsonData,
            result?.result?.jsonSignature,
          ],
          abi,
          functionName: "mint",
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } as any,
        {
          onSuccess: (transaction) => {
            plausible("Minted");
            setTransactionHash(transaction);
          },
          onError: (...args) => {
            console.log("error", args);
            plausible("MintError", { props: { error: args[0].message } });
            setMinted("error");
          },
        }
      );
    };
    doMint();
  }, [minted, wallet, result, writeContractAsync, plausible]);
  const waitResults = useWaitForTransactionReceipt({
    hash: transactionHash as `0x${string}`,
    confirmations: 2,
  });
  useEffect(() => {
    if (waitResults.data?.status === "success") {
      const log = waitResults?.data?.logs[0];
      const info = log
        ? decodeEventLog({
            ...log,
            abi: [
              {
                anonymous: false,
                inputs: [
                  {
                    indexed: true,
                    internalType: "address",
                    name: "operator",
                    type: "address",
                  },
                  {
                    indexed: true,
                    internalType: "address",
                    name: "from",
                    type: "address",
                  },
                  {
                    indexed: true,
                    internalType: "address",
                    name: "to",
                    type: "address",
                  },
                  {
                    indexed: false,
                    internalType: "uint256",
                    name: "id",
                    type: "uint256",
                  },
                  {
                    indexed: false,
                    internalType: "uint256",
                    name: "value",
                    type: "uint256",
                  },
                ],
                name: "TransferSingle",
                type: "event",
              },
            ],
          })
        : null;
      const url = `https://opensea.io/assets/base/${log.address || ""}/${
        info?.args?.id || ""
      }`;
      plausible("MintComplete", { props: { url, tokenId: info?.args?.id } });
      setMinted(url);
      setTransactionHash(undefined);
    }
  }, [waitResults, plausible]);

  const onCast = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      plausible("Cast", { props: { url: result?.result?.frameUrl } });
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
    [isCompose, result, text, plausible]
  );
  const onTweet = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      plausible("Tweet", { props: { url: result?.result?.frameUrl } });

      window.open(
        `https://x.com/intent/tweet?url=${
          result?.result?.frameUrl
        }&text=${encodeURIComponent(text)}`,
        "_blank"
      );
    },
    [result, text, plausible]
  );

  if (!wallet.isConnected || !remoteAddress) {
    return (
      <>
        <h1 className="text-center text-3xl">
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
            {minted === "pending" ? (
              <div className="flex items-center space-x-2">
                Assembling and minting your NFT to the future...
                <div className="animate-pulse">🔨</div>
              </div>
            ) : minted === "error" ? (
              <div className="flex items-center space-x-2">
                Failed to mint your NFT to the future. Please try again.
                <div>😢</div>
              </div>
            ) : minted ? (
              <a
                href={minted}
                target="_blank"
                className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
                rel="noreferrer"
              >
                View on OpenSea
              </a>
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
                href={result?.result?.external_url.replace(
                  "https://nft-to-the-future.shipstone.com/",
                  `${document.location.origin}/`
                )}
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
          {/* <div className="whitespace-pre font-sans text-base overflow-scroll p-4 w-full">
            {JSON.stringify(result?.result, null, 2)}
          </div> */}
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
