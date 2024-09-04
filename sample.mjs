// Required Node.js libraries
import fetch from "node-fetch";
import { config } from "dotenv";
import { ethers } from "ethers";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import {
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  createSiweMessageWithRecaps,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { access } from "fs";

config({ path: ".env.local" });
config({ path: ".env" });

const NETWORK = "base";
const CID = "QmNutAr2VGesUPZ7A5vKQzqqHHoPaYDovkwT1ZBVJSuWe6";
const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7
).toISOString();

// Main function to run the sequence
async function run() {
  const NETWORK = "base";
  try {
    console.log(
      "Trying to decrypt",
      ciphertext,
      dataToEncryptHash,
      accessControlConditions
    );
    const data = await Lit.Actions.decryptAndCombine({
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      chain: "ethereum",
    });
    console.log("Decrypted data:", data);
    const { input, apiKey, orgId, projectId, pinataJwt } = JSON.parse(data);
    console.log("Decrypted data:", input, apiKey, orgId, projectId, pinataJwt);
    const promptQuery = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Create a good looking picture by taking ideas of the following message \`${input}\`. Summarize and simplify the text such that it would become a good prompt for image generation. Generate a good looking dark fantasy image. Please return only the prompt text for the image generation. Please describe any well-known characters with your own words for dall-e-3 to use and make sure it doesn't get rejected by the dall-e-safety system.`,
        },
      ],
      temperature: 0.7,
    };

    const promptResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Organization": orgId,
          "OpenAI-Project": projectId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(promptQuery),
      }
    );

    const promptData = await promptResponse.json();
    const prompt = promptData.choices[0].message.content.trim();

    const imageQuery = {
      model: "dall-e-3",
      prompt: `Generate an image with the following description: \`${prompt}\` and make sure it looks like the scene set in the future.`,
      response_format: "url",
      size: "1024x1024",
      quality: "standard",
      n: 1,
    };

    const imageResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Organization": orgId,
          "OpenAI-Project": projectId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imageQuery),
      }
    );

    const imageData = await imageResponse.json();
    const { url } = imageData.data[0];
    Lit.Actions.setResponse({ response: url });
    return url;
  } catch (error) {
    console.error("Error during execution:", error);
    Lit.Actions.setResponse({ response: error });
  }
}

const js = `${run.toString()}; run();`;

console.log(process.env.API_KEY, js);
const wallet = new ethers.Wallet(process.env.API_KEY);

const genAuthSig = async (wallet, client, uri, resources) => {
  const blockHash = await client.getLatestBlockhash();
  const message = await createSiweMessageWithRecaps({
    walletAddress: wallet.address,
    nonce: blockHash,
    litNodeClient: client,
    resources,
    chain: NETWORK,
    expiration: ONE_WEEK_FROM_NOW,
    uri,
  });
  const authSig = await generateAuthSig({
    signer: wallet,
    toSign: message,
    address: wallet.address,
  });

  return authSig;
};

const genSession = async (wallet, client, resources) => {
  const sessionSigs = await client.getSessionSigs({
    chain: NETWORK,
    resourceAbilityRequests: resources,
    authNeededCallback: async (params) => {
      console.log("resourceAbilityRequests:", params.resources);

      if (!params.expiration) {
        throw new Error("expiration is required");
      }

      if (!params.resources) {
        throw new Error("resourceAbilityRequests is required");
      }

      if (!params.uri) {
        throw new Error("uri is required");
      }

      // generate the authSig for the inner signature of the session
      // we need capabilities to assure that only one api key may be decrypted
      const authSig = genAuthSig(
        wallet,
        client,
        params.uri,
        params.resourceAbilityRequests ?? []
      );
      return authSig;
    },
  });

  return sessionSigs;
};

const litNodeClient = new LitNodeClient({
  litNetwork: LitNetwork.DatilDev,
  debug: false,
});

await litNodeClient.connect();
console.log("Connected to Lit Network");

const sessionSignatures = await genSession(wallet, litNodeClient, [
  {
    resource: new LitAccessControlConditionResource("*"),
    ability: LitAbility.AccessControlConditionDecryption,
  },
]);

const unifiedAccessControlConditions = [
  {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "",
    chain: "base",
    method: "eth_getBalance",
    parameters: [":userAddress", "latest"],
    returnValueTest: {
      comparator: ">",
      value: "0",
    },
  },
  // {
  //   conditionType: "evmBasic",
  //   contractAddress: "",
  //   standardContractType: "",
  //   chain: NETWORK,
  //   method: "",
  //   parameters: [":userAddress"],
  //   returnValueTest: {
  //     comparator: "=",
  //     value: wallet.address,
  //   },
  // },
  { conditionType: "operator", operator: "or" },
  {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "timestamp",
    chain: NETWORK,
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
  dataToEncrypt: new TextEncoder().encode(
    JSON.stringify({
      input: "this is a secret message",
      apiKey: process.env.OPENAI_API_KEY,
      orgId: process.env.OPENAI_ORGANIZATION_ID,
      projectId: process.env.OPENAI_PROJECT_ID,
      pinataJwt: process.env.PINATA_JWT,
    })
  ),
});

console.log("Encrypted data:", ciphertext, dataToEncryptHash);

const accessControlConditions = [
  {
    contractAddress: "",
    standardContractType: "",
    chain: NETWORK,
    method: "eth_getBalance",
    parameters: [":userAddress", "latest"],
    returnValueTest: {
      comparator: ">",
      value: "0",
    },
  },
  // {
  //   conditionType: "evmBasic",
  //   contractAddress: "",
  //   standardContractType: "",
  //   chain: NETWORK,
  //   method: "",
  //   parameters: [":userAddress"],
  //   returnValueTest: {
  //     comparator: "=",
  //     value: wallet.address,
  //   },
  // },
];

const accsResourceString =
  await LitAccessControlConditionResource.generateResourceString(
    accessControlConditions,
    dataToEncryptHash
  );

const sessionForDecryption = await genSession(wallet, litNodeClient, [
  {
    resource: new LitActionResource("*"),
    ability: LitAbility.LitActionExecution,
  },
  {
    resource: new LitAccessControlConditionResource(accsResourceString),
    ability: LitAbility.AccessControlConditionDecryption,
  },
]);

const output = await litNodeClient.executeJs({
  code: js,
  // cid: CID,
  sessionSigs: sessionForDecryption,
  chain: NETWORK,
  jsParams: {
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
    publicKey: wallet.signingKey.publicKey,
  },
});
console.log("Output:", output);
// Run the main function
// await run(litNodeClient, ciphertext, dataToEncryptHash);
