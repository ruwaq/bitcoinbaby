import { generateOnChainRenderer } from "../packages/bitcoin/src/inscription/onchain-renderer";

const html = generateOnChainRenderer({ libraryInscriptionId: "abc123i0" });
console.log("HTML CONTAINS DANGEROUS REGEX:");
const line = html.split("\n").find(l => l.includes("DANGEROUS"));
console.log(line);
console.log("REGEX IN EMITTED HTML:", line?.match(/DANGEROUS=(.*?);/)?.[1]);
