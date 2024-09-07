import { LitNetwork } from "@lit-protocol/constants";
import { AccessControlConditions, LitAbility } from "@lit-protocol/types";
import { ethers, Wallet } from "ethers";
import { Base64 } from "js-base64";
import { type NextRequest, NextResponse } from "next/server";
import { genSession, NETWORK } from "../../../request/litAction";
import { LitAccessControlConditionResource } from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LitNodeClient } from "@lit-protocol/lit-node-client";

export async function GET(
  req: NextRequest,
  ctx: { params: { cid: string; hash: string } }
) {
  const { cid, hash } = ctx.params;
  const url = `https://ipfs.io/ipfs/${cid}`;
  const encoder = new TextEncoder();
  const checkHash = Base64.fromUint8Array(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(`${url}-haha`))
    )
  )
    .replace(/\+/g, "-") // Replace + with -
    .replace(/\//g, "_") // Replace / with _
    .replace(/=+$/, ""); // Remove trailing =

  if (checkHash !== hash) {
    return NextResponse.json(
      {
        description: "Message Not Found, maybe you're in the wrong Universe!",
      },
      { status: 404 }
    );
  }
  const data = await fetch(url)
    .then((res) => {
      if (!res.ok) {
        throw new Error("Not found");
      }
      if (res.headers.get("Content-Type") === "application/json") {
        return res.json();
      }
      res.body?.cancel();
      throw new Error("Not found");
    })
    .catch(() => {
      return {
        description: "Message Not Found, maybe you're in the wrong Universe!",
      };
    });

  const wallet = new Wallet(
    process.env.API_KEY as string,
    ethers.getDefaultProvider("base")
  );

  const litNodeClient = new LitNodeClient({
    litNetwork: LitNetwork.DatilDev,
    debug: false,
  });
  await litNodeClient.connect();
  try {
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
    const { decryptedData } = await litNodeClient.decrypt({
      accessControlConditions: data.message[2],
      dataToEncryptHash: data.message[1],
      ciphertext: data.message[0],
      sessionSigs: sessionSignatures,
      chain: NETWORK,
    });
    const decoder = new TextDecoder();
    data.publicMessage = decoder.decode(decryptedData);
  } catch (error) {
    console.error("Error during execution", error);
    data.error = (error as { message: string }).message;
  } finally {
    await litNodeClient.disconnect();
  }
  return NextResponse.json(data);
}
