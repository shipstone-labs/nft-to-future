"use client";

import React, { useState } from "react";
import Wallet from "@/components/Wallet";
import { LitConnection } from "@/components/LitConnection";

const HomePage = () => {
  return (
    <Wallet>
      <div className="p-4 flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-4">Lit Protocol + Next.js</h1>
      </div>
      <LitConnection>Connected</LitConnection>
    </Wallet>
  );
};

export default HomePage;
