// Required Node.js libraries
import fetch from "node-fetch";
import { config as dotenvConfig } from "dotenv";
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
import { NETWORK, js, genAuthSig, genSession } from "./sampleLit.js";

dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

const CID = "QmNutAr2VGesUPZ7A5vKQzqqHHoPaYDovkwT1ZBVJSuWe6";
const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7
).toISOString();

// Main function to run the sequence
const config = [];
const data = [];

console.log("// ----------");
console.log(js);
console.log("// ----------");

const wallet = new ethers.Wallet(process.env.API_KEY);

const litNodeClient = new LitNodeClient({
  litNetwork: LitNetwork.DatilDev,
  debug: false,
});

await litNodeClient.connect();

const sessionSignatures = await genSession(wallet, litNodeClient, [
  {
    resource: new LitAccessControlConditionResource("*"),
    ability: LitAbility.AccessControlConditionDecryption,
  },
]);

const configAccessControlConditions = [
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
];

const unifiedAccessControlConditions = [
  {
    contractAddress: "",
    standardContractType: "",
    chain,
    method: "",
    parameters: [":userAddress"],
    returnValueTest: {
      comparator: "=",
      value: wallet.address,
    },
  },
  // {
  //   conditionType: "evmBasic",
  //   contractAddress: "",
  //   standardContractType: "",
  //   chain: "base",
  //   method: "eth_getBalance",
  //   parameters: [":userAddress", "latest"],
  //   returnValueTest: {
  //     comparator: ">",
  //     value: "0",
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
      value: Math.round((Date.now() + 60000) / 1000).toString(),
    },
  },
];

// encrypt
let _config = [];
{
  const { ciphertext, dataToEncryptHash } = await litNodeClient.encrypt({
    unifiedAccessControlConditions: configAccessControlConditions,
    dataToEncrypt: new TextEncoder().encode(
      JSON.stringify({
        apiKey: process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORGANIZATION_ID,
        projectId: process.env.OPENAI_PROJECT_ID,
      })
    ),
  });
  _config = [ciphertext, dataToEncryptHash, configAccessControlConditions];
}

const message = "There is going to be life on Mars.";
let _input = [];
{
  const { ciphertext, dataToEncryptHash } = await litNodeClient.encrypt({
    unifiedAccessControlConditions,
    dataToEncrypt: new TextEncoder().encode(message),
  });
  _input = [ciphertext, dataToEncryptHash, unifiedAccessControlConditions];
}

const accsInput =
  await LitAccessControlConditionResource.generateResourceString(
    unifiedAccessControlConditions,
    _input[1]
  );
const accsConfig =
  await LitAccessControlConditionResource.generateResourceString(
    unifiedAccessControlConditions,
    _config[1]
  );

const sessionForDecryption = await genSession(wallet, litNodeClient, [
  {
    resource: new LitActionResource("*"),
    ability: LitAbility.LitActionExecution,
  },
  {
    resource: new LitAccessControlConditionResource(accsInput),
    ability: LitAbility.AccessControlConditionDecryption,
  },
  {
    resource: new LitAccessControlConditionResource(accsConfig),
    ability: LitAbility.AccessControlConditionDecryption,
  },
]);

const output = await litNodeClient.executeJs({
  code: js,
  // cid: CID,
  sessionSigs: sessionForDecryption,
  chain: NETWORK,
  jsParams: {
    accessControlConditions: unifiedAccessControlConditions,
    data: _input,
    config: _config,
    publicKey: wallet.signingKey.publicKey,
  },
});
console.log("Output:", output);
{
  const {
    message: [ciphertext, dataToEncryptHash],
    url,
  } = JSON.parse(output.response);
  console.log(ciphertext, dataToEncryptHash, url);

  for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    console.log("trying", t);
    try {
      const { decryptedData } = await litNodeClient.decrypt({
        accessControlConditions: unifiedAccessControlConditions.slice(2),
        ciphertext,
        sessionSigs: sessionSignatures,
        dataToEncryptHash,
        chain: NETWORK,
      });
      console.log(new TextDecoder().decode(decryptedData));
      break;
    } catch (error) {
      console.error(error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

process.exit();
