import path from "node:path";

const config = {
  plugins: {
    "postcss-import": { path: [path.resolve(process.cwd(), "node_modules")] },
    "@tailwindcss/postcss": {},
  },
};

export default config;
