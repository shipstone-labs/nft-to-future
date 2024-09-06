import { type NextRequest, NextResponse } from "next/server";
import { type ClientOptions, OpenAI } from "openai";
import { Base64 } from "js-base64";
import imageCompression from "browser-image-compression";
import abi from "./abi.json";
import { recordEvent } from "../frame/handler";
import { LitNetwork } from "@lit-protocol/constants";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { ethers, toBeHex, Wallet } from "ethers";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import {
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
} from "@lit-protocol/auth-helpers";
import { genSession, js, NETWORK } from "./litAction";
import type { AccessControlConditions } from "@lit-protocol/types";

// export const runtime = "nodejs";

const configuration = {
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
  organization: process.env.OPENAI_ORGANIZATION_ID,
  dangerouslyAllowBrowser: true,
};

const openai = new OpenAI(configuration);
const wallet = new Wallet(
  process.env.API_KEY as string,
  ethers.getDefaultProvider("base")
);

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
    const { message, address, date } = (await req.json()) as {
      message: [string, string, AccessControlConditions];
      address?: string;
      date?: number;
    };

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

    const litContracts = new LitContracts({
      privateKey: process.env.API_KEY as string,
      network: LitNetwork.DatilTest,
      debug: false,
    });
    await litContracts.connect();

    let _config: [string, string, AccessControlConditions] = [
      "",
      "",
      message[2],
    ];
    {
      const { ciphertext, dataToEncryptHash } = await litNodeClient.encrypt({
        unifiedAccessControlConditions: message[2],
        dataToEncrypt: new TextEncoder().encode(
          JSON.stringify({
            apiKey: process.env.OPENAI_API_KEY,
            orgId: process.env.OPENAI_ORGANIZATION_ID,
            projectId: process.env.OPENAI_PROJECT_ID,
          })
        ),
      });
      _config = [ciphertext, dataToEncryptHash, message[2]];
    }

    const accsInput =
      await LitAccessControlConditionResource.generateResourceString(
        message[2],
        message[1]
      );
    const accsConfig =
      await LitAccessControlConditionResource.generateResourceString(
        message[2].slice(0, 1),
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
      jsParams: {
        accessControlConditions: message[2],
        data: message,
        config: _config,
        publicKey: wallet.signingKey.publicKey,
      },
    });
    const outputObject = JSON.parse(output.response as string);
    console.log(output);
    let jsonUrl: string | undefined;
    const { url } = (output as any) || {};
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
            new Date(date || Date.now())
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
          jsonUrl = toBeHex(jsonSrc);
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
