import {
  createSiweMessageWithRecaps,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import type { LitNodeClient } from "@lit-protocol/lit-node-client";
import type { LitResourceAbilityRequest } from "@lit-protocol/types";
import type { Wallet } from "ethers";

export const NETWORK = "base";
export const js = `const NETWORK = "${NETWORK}";
async function run() {
  try {
    const input = await Lit.Actions.decryptAndCombine({
      accessControlConditions: data[2],
      ciphertext: data[0],
      dataToEncryptHash: data[1],
      chain: NETWORK,
    });
    const configJson = await Lit.Actions.decryptAndCombine({
      accessControlConditions: config[2],
      ciphertext: config[0],
      dataToEncryptHash: config[1],
      chain: NETWORK,
    });
    const { apiKey, orgId, projectId, pinataJwt } = JSON.parse(configJson);
    const promptQuery = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: \`Create a good looking picture by taking ideas of the following message \\\`\${input}\\\`. Summarize and simplify the text such that it would become a good prompt for image generation. Generate a good looking dark fantasy image. Please return only the prompt text for the image generation. Please describe any well-known characters with your own words for dall-e-3 to use and make sure it doesn't get rejected by the dall-e-safety system.\`,
        },
      ],
      temperature: 0.7,
    };

    const promptResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${apiKey}\`,
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
      prompt: \`Generate an image with the following description: \\\`\${prompt}\\\` and make sure it looks like the scene set in the future. Make sure the image is not too obvious to keep normal humans guessing as what to the image means.\`,
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
          Authorization: \`Bearer \${apiKey}\`,
          "OpenAI-Organization": orgId,
          "OpenAI-Project": projectId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imageQuery),
      }
    );

    const imageData = await imageResponse.json();
    const { url } = imageData.data[0];

    const { ciphertext: _ciphertext, dataToEncryptHash: _dataToEncryptHash } =
      await Lit.Actions.encrypt({
        accessControlConditions: data[2].slice(2),
        to_encrypt: new TextEncoder().encode(input),
      });
    Lit.Actions.setResponse({
      response: JSON.stringify({
        message: [_ciphertext, _dataToEncryptHash],
        url,
      }),
    });
  } catch (error) {
    console.error("Error during execution:", error);
    Lit.Actions.setResponse({ response: error.message });
  }
}
run();`;

const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7
).toISOString();

export const genAuthSig = async (
  wallet: Wallet,
  client: LitNodeClient,
  uri: string,
  resources: LitResourceAbilityRequest[]
) => {
  const blockHash = await client.getLatestBlockhash();
  const message = await createSiweMessageWithRecaps({
    walletAddress: wallet.address,
    nonce: blockHash,
    litNodeClient: client,
    resources,
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

export const genSession = async (
  wallet: Wallet,
  client: LitNodeClient,
  resources: LitResourceAbilityRequest[]
) => {
  const sessionSigs = await client.getSessionSigs({
    chain: NETWORK,
    resourceAbilityRequests: resources,
    authNeededCallback: async (params) => {
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
