import { readFile, readdir, writeFile } from 'node:fs/promises';

/** Firebase's SDK generator sometimes references output enums in .d.ts without
 * declaring them. Add type aliases only; the generated JS has no enum values. */
export function addOutputOnlyEnumTypes(declarations, schema) {
  const uncommented = schema.replace(/#[^\n]*/g, ' ');
  const missing = [];
  for (const match of uncommented.matchAll(/\benum\s+([A-Za-z_]\w*)\s*\{([^}]*)\}/g)) {
    const [, name, body] = match;
    const declared = new RegExp(
      `\\bexport\\s+(?:declare\\s+)?(?:enum|type|interface)\\s+${name}\\b`,
    );
    if (declared.test(declarations) || !new RegExp(`\\b${name}\\b`).test(declarations)) continue;
    const values = body.match(/[A-Za-z_]\w*/g) ?? [];
    if (values.length === 0) throw new Error(`Schema enum ${name} has no values`);
    missing.push(
      `export type ${name} = ${values.map((value) => JSON.stringify(value)).join(' | ')};`,
    );
  }
  if (missing.length === 0) return declarations;
  const anchor = /^(export type DateString = string;\r?\n)/m;
  if (!anchor.test(declarations)) throw new Error('Generated SDK declaration anchor not found');
  return declarations.replace(anchor, `$1\n${missing.join('\n')}\n`);
}

export async function postprocessSdkEnums(schemaDir, declarationPaths) {
  const schemaFiles = (await readdir(schemaDir, { recursive: true }))
    .filter((name) => name.endsWith('.gql'))
    .sort();
  const schema = (
    await Promise.all(schemaFiles.map((name) => readFile(new URL(name, schemaDir), 'utf8')))
  ).join('\n');
  for (const declarationPath of declarationPaths) {
    const source = await readFile(declarationPath, 'utf8');
    const processed = addOutputOnlyEnumTypes(source, schema);
    if (processed !== source) await writeFile(declarationPath, processed);
  }
}
