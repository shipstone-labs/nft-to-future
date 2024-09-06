/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "build",
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
