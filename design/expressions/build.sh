#!/bin/sh
# Rebuild index.html: bundle cloudEngine.ts as an IIFE and inline it into src.html.
set -e
cd "$(dirname "$0")"
tmp=$(mktemp -d)
echo 'import { CloudEngine } from "../../src/components/vobi/cloudEngine"; (window as unknown as { CloudEngine: unknown }).CloudEngine = CloudEngine;' > entry.ts
bun build entry.ts --format iife --outfile "$tmp/engine.js" >/dev/null
rm entry.ts
bun -e 'const fs=require("fs");const [src,eng,out]=process.argv.slice(1);fs.writeFileSync(out,fs.readFileSync(src,"utf8").replace("/*ENGINE*/",()=>fs.readFileSync(eng,"utf8")))' src.html "$tmp/engine.js" index.html
rm -rf "$tmp"
