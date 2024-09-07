/** @type {import('next').NextConfig} */

import { appConfig } from "./src/app/config.mjs";
import fs from "node:fs";

const manifest = {
  name: appConfig.appName,
  short_name: appConfig.appName,
  icons: appConfig.icons.map((icon) => ({
    src: icon.url,
    sizes: icon.sizes,
    type: icon.type || "image/png",
  })),
  theme_color: appConfig.themeColor,
  background_color: appConfig.themeColor,
  display: "standalone",
  start_url: "/",
};

fs.writeFileSync("public/manifest.json", JSON.stringify(manifest, null, 2));
console.log("manifest.json has been generated!");

const nextConfig = {
  distDir: "build",
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Replace node-fetch with empty module or a custom implementation
      config.resolve.alias["node-fetch"] = false;
      config.resolve.mainFields = ["main", "module"]; // Prefer 'main' (CJS) over 'module' (ESM)
    }
    // config.module.rules.push({
    //   test: /\.(js|jsx|ts|tsx)$/,
    //   include: /app\/api\//, // Target only the app/api directory
    //   use: [
    //     {
    //       loader: "babel-loader", // Use Babel loader for these files
    //       options: {
    //         presets: [
    //           [
    //             "@babel/preset-env",
    //             {
    //               targets: {
    //                 node: "current", // This targets the current version of Node.js
    //               },
    //             },
    //           ],
    //           "@babel/preset-typescript",
    //         ],
    //       },
    //     },
    //   ],
    // });

    return config;
  },
};

export default nextConfig;
