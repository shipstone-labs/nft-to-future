import { type NextRequest, NextResponse } from "next/server";
import { type ClientOptions, OpenAI } from "openai";
import { Base64 } from "js-base64";
import imageCompression from "browser-image-compression";
import abi from "./abi.json";
import { privateKeyToAccount } from "viem/accounts";
import { recordEvent } from "../frame/handler";
import { LitNetwork } from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { ethers, Wallet } from "ethers";
import { LitAbility, LitPKPResource } from "@lit-protocol/auth-helpers";
import { stringToHex } from "viem";

export const runtime = "edge";

const configuration: ClientOptions = {
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
  organization: process.env.OPENAI_ORGANIZATION_ID,
  dangerouslyAllowBrowser: true,
};

const openai = new OpenAI(configuration);
const wallet = new Wallet(process.env.API_KEY as string);

async function pinURLtoIPFS(url: string) {
  const formData = new FormData();

  const data = await fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.statusText}`);
    }
    const blob = await res.blob();
    if (res.headers.get("Content-Type") === "image/webp") {
      return await imageCompression(blob as File, {
        useWebWorker: true, // optional, use multi-thread web worker, fallback to run in main-thread (default: true)
        // signal: AbortSignal, // optional, to abort / cancel the compression
        fileType: "image/png", // optional, fileType override e.g., 'image/jpeg', 'image/png' (default: file.type)
        alwaysKeepResolution: true, // optional, only reduce quality, always keep width and height (default: false)
      });
    }
    return blob;
  });
  formData.append("file", data);
  return await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(
        `Failed to pin file to IPFS: ${res.statusText} ${await res.text()}`
      );
    }
    return await res.json();
  });
}

async function pinJSONtoIPFS(pinataContent: Record<string, unknown>) {
  return await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    body: JSON.stringify({ pinataContent }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(
        `Failed to pin JSON to IPFS: ${res.statusText} ${await res.text()}`
      );
    }
    return await res.json();
  });
}

async function calcFrameUrl(url: string) {
  const encoder = new TextEncoder();
  const [_ignore, cid] = url.match(/\/ipfs\/(.*?)($|\?)/) || [];
  const hash = Base64.fromUint8Array(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(`${url}-haha`))
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `https://nft-to-future.com/api/frame/${cid}/${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const litNodeClient = new LitNodeClient({
      litNetwork: LitNetwork.DatilDev,
      debug: false,
    });

    await litNodeClient.connect();

    const litContracts = new LitContracts({
      signer: wallet,
      network: LitNetwork.DatilTest,
      debug: false,
    });
    await litContracts.connect();

    const sessionSignatures = await litNodeClient.getPkpSessionSigs({
      pkpPublicKey: wallet.signingKey.publicKey,
      capabilityAuthSigs: [],
      authMethods: [],
      resourceAbilityRequests: [
        {
          resource: new LitPKPResource("*"),
          ability: LitAbility.PKPSigning,
        },
      ],
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
    });

    const input = (await req.json()) as {
      encryptedMessage: string;
      address?: string;
      futureDate?: number;
    };

    // console.log("input", input);
    const { encryptedMessage, address, futureDate = Date.now() } = input;

    const { decryptedMessage: _decodedMessage } = await litNodeClient.decrypt({
      encryptedMessage,
      pkpPublicKey: wallet.signingKey.publicKey,
      sessionSignatures,
    });

    const decodedMessage = new TextDecoder().decode(_decodedMessage);
    console.log(decodedMessage);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Use the appropriate model
      messages: [
        {
          role: "user",
          content: `Create a good looking picture by taking ideas of the following message \`${decodedMessage}\`. Summarize and simplify the text such that it would become a good prompt for image generation. Generate a good looking dark fantasy image. Please return only the prompt text for the image generation. Please describe any well-known characters with your own words for dall-e-3 to use and make sure it doesn't get rejected by the dall-e-safety system.`,
        },
      ],
    });

    const response2 = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Generate an image with the following description: ${
        completion.choices[0].message.content || "there was an error."
      } and make sure it looks like the scene set in the future.`,
      response_format: "url",
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    let jsonUrl: string | undefined;
    const { url } = response2.data[0];
    let pngUrl: string | undefined = url;
    let frameUrl: string | undefined = url;
    if (url) {
      try {
        const imageFile = await pinURLtoIPFS(url);
        if (imageFile) {
          pngUrl = `https://ipfs.io/ipfs/${imageFile.IpfsHash}`;
          frameUrl = await calcFrameUrl(pngUrl);
        }
      } catch {
        // ignore
      }
    }
    let transaction: `0x${string}` | undefined;
    if (url && pngUrl) {
      try {
        const json = {
          name: "NFT to Future!",
          description: `Shipstone Lab's NTF to Future: Mint an NFT containing a message readable in the future on ${new Date(
            futureDate
          ).toUTCString()}`,
          image: pngUrl,
          decimals: 0,
          attributes: [],
          properties: {
            creator: {
              name: "Shipstone Labs",
              profile_url: "https://shipstone.com",
            },
          },
          creator: {
            name: "Shipstone Labs",
            profile_url: "https://shipstone.com",
          },
          external_url: "https://nft-to-future.shipstone.com",
          // "animation_url": "https://ipfs.io/ipfs/Qm.../sword-animation.mp4",
          background_color: "FFFFFF",
          // "youtube_url": "https://www.youtube.com/watch?v=abcdefg"
        };
        ({ IpfsHash: jsonUrl } = (await pinJSONtoIPFS(json)) || {});

        if (jsonUrl) {
          const jsonSrc = `https://ipfs.io/ipfs/${jsonUrl}`;
          jsonUrl = stringToHex(jsonSrc);
          frameUrl = await calcFrameUrl(jsonSrc);
        }
      } catch (error) {
        console.error(error);
      }
    }
    return NextResponse.json(
      {
        done: true,
        result: {
          url,
          jsonUrl,
          pngUrl,
          frameUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as { message: string }).message },
      { status: 500 }
    );
  }
}
