# NFT to the future

## Getting Started

Install all required modules. Please use mise or something similar to get the correct version of node. You can use

```bash
npm install -g pnpm
```

if you don't have pnpm already.

Then install all modules (you only need to do this once)

```bash
pnpm install
```

Prepare to run

```bash
cp .env.example .env.local
```

and fill in the required values. The API_KEY is a private key
for the owner of the NFT token. Currently we deployed an older version of https://github.com/shipstone-labs/nft-to-the-future-token/blob/main/contracts/TokenCollectionERC1155.sol. So the privateKey in API_KEY has to have deployed this contract and this contract has to be
added to NEXT_PUBLIC_NFT_CONTRACT_ADDRESS.
That way the backend can create a good signature
to protect the mint function.

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

- Connect a wallet (it will be using the base network)
- Write your message and hit send
- Approve the sign request to allow encryption of your message.
- Wait till it's encrypted and processed for minting
- Approve the mint step inside of the wallet.
- You can click Read to go to the read link directly.
- Or you can first go to Opensea and select "Visit Website" to get to the read link.
- The read page will either show the message or show an error and wait until it can show the message.

## How it works

- Connecting the wallet provides a signer and an address to NFT to the future.
- The backend will return the public address for the token contract owner.
- When clicking "Encrypt" it uses the signer to construct session signatures for the LIT Protocol and activates the contracts.
- Then it uses the encrypt method to encrypt the message. It will encrypt the message only readable by the token contract owner or after the publish date.
- It sends the encrypted string, it's hash and the access criteria along with other data to the backend.
- In the backend it assembles some secrets from the environment to be able to talk to openai. It then connects to LIT using the token contract owner's wallet.
- It uses LIT to encrypt the openai secrets to be only readable by it's address.
- It then sends both the encrypted message and the encrypted secrets to a lit action using the session signatures from the token contract owner.
- Within the lit action it will decrypt both the secrets and the secret message.
- It then sends the secret message, instructing AI to create an image which doesn't reveal the message but might show some aspects.
- It then re-encrypts the message dropping the "token contract owner" access condition and returns the image URL and the encrypted image from the lit action.
- The backend then constructs various pinata pins for the image and JSON files for the NFT metadata.
- It calculates a signature of the NFT metadata url required for the frontend to mint the NFT.
- A packet containing all this data (note the data is encrypted and cannot be read) is sent to the frontend.
- The frontend responds by sending the transaction on chain using the wallet the user connected to the site.
- There are no additional charges other than gas fees for sending your message to the future.
- Once it's minted the Show on OpenSea button shows.
- Going to this link you will see your NFT in all it's glory.
- There is a link called "Visit WebSite" inside of the ... menu which will then go to the reading page.
- The page will either show the message or tell you that there was an error because you're not allowed to read it yet and it will then wait until that time.
- Once the time was hit it will decrypt the message one second later (we added a second so no clock drift will cause problems.) NOTE: It uses the actual block time on chain so if the browser things it's early then it probably was :)

## Deploy on Vercel

This is from the original nextjs docs:

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

The current example deployment is on GCP, because we wanted
to use cloudflare but LIT Protocol doesn't currently support
the edge runtime as of now.
