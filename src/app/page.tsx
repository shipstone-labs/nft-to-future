"use client";

import React, { useState } from "react";
import Wallet from "@/components/Wallet";
import { LitConnection } from "@/components/LitConnection";

const HomePage = () => {
  return (
    <Wallet>
      <div className="p-4 flex flex-col items-center">
        <h1 className="text-2xl font-bold">NFT to the Future!</h1>
      </div>
      <LitConnection />
    </Wallet>
  );
};

export default HomePage;
