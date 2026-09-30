import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
export function inspectArtifact(dir: string): {
  files: string[];
  buildHash: string;
} {
  if (!existsSync(join(dir, "index.html")))
    throw new Error("Hosting public must contain the browser index.html");
  const files: string[] = [];
  const hash = createHash("sha256");
  function walk(folder: string) {
    for (const name of readdirSync(folder).sort()) {
      const full = join(folder, name),
        path = relative(dir, full),
        stat = lstatSync(full);
      if (stat.isSymbolicLink())
        throw new Error(`Symlink in Hosting artifact: ${path}`);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (
        !/\.(html|js|css|svg|png|jpg|jpeg|ico|webp|json|woff2?|ttf|txt)$/.test(
          path,
        ) ||
        /(^|\/)(\.|.*\.local\.)|credentials|service.account|ngsw/i.test(path)
      )
        throw new Error(`Private or unexpected Hosting artifact: ${path}`);
      const bytes = readFileSync(full);
      if (
        /\.(html|js|css|json|txt)$/.test(path) &&
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"private_key"\s*:|"type"\s*:\s*"service_account"/.test(
          bytes.toString(),
        )
      )
        throw new Error(`Private credential in Hosting artifact: ${path}`);
      files.push(path);
      hash.update(path + "\0");
      hash.update(bytes);
    }
  }
  walk(dir);
  return { files, buildHash: hash.digest("hex") };
}
export async function checkHosting(baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol))
    throw new Error("HTTP(S) URL required");
  if (
    base.protocol === "http:" &&
    !["127.0.0.1", "localhost"].includes(base.hostname)
  )
    throw new Error("Remote Hosting must use HTTPS");
  const root = await fetch(base, { signal: AbortSignal.timeout(10000) });
  const html = await root.text();
  for (const path of ["/", "/salons/not-bad-stuff-demo%3Alegnicka", "/login"]) {
    const response = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(10000),
    });
    if (
      response.status !== 200 ||
      !response.headers.get("content-type")?.includes("text/html") ||
      !response.headers.get("cache-control")?.includes("no-cache") ||
      (await response.text()) !== html
    )
      throw new Error(`SPA route/header check failed: ${path}`);
  }
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(
    (m) => m[1],
  );
  if (!assets.length) throw new Error("No browser assets found");
  for (const asset of assets) {
    const response = await fetch(new URL(asset, base), {
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error(`Missing asset: ${asset}`);
  }
  return { url: baseUrl, routes: 3, assets: assets.length };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string" },
      public: { type: "string", default: "web/dist/barberhq/browser" },
    },
  });
  console.log(inspectArtifact(resolve(values.public!)));
  if (values["base-url"]) console.log(await checkHosting(values["base-url"]));
}
