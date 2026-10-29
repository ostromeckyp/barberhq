import { createScanner, SyntaxKind } from 'typescript/unstable/ast';

/** Read only the actual top-level global options call, never incidental text. */
export function sourceRuntimeAccount(index: string): string | undefined {
  const scanner = createScanner(true, undefined, index);
  const tokens: { kind: SyntaxKind; value: string; depth: number }[] = [];
  let depth = 0;
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    tokens.push({ kind, value: scanner.getTokenValue(), depth });
    if (kind === SyntaxKind.OpenBraceToken) depth++;
    if (kind === SyntaxKind.CloseBraceToken) depth--;
  }
  const accounts: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (
      tokens[i].kind !== SyntaxKind.Identifier ||
      tokens[i].value !== 'setGlobalOptions' ||
      tokens[i].depth !== 0 ||
      tokens[i + 1]?.kind !== SyntaxKind.OpenParenToken
    )
      continue;
    if (tokens[i - 1]?.kind === SyntaxKind.DotToken) return undefined;
    const body = tokens.slice(i + 2, i + 9);
    if (
      body[0]?.kind !== SyntaxKind.OpenBraceToken ||
      body[1]?.kind !== SyntaxKind.Identifier ||
      body[1]?.value !== 'serviceAccount' ||
      body[2]?.kind !== SyntaxKind.ColonToken ||
      body[3]?.kind !== SyntaxKind.StringLiteral
    )
      return undefined;
    const closing = body[4]?.kind === SyntaxKind.CommaToken ? 5 : 4;
    if (
      body[closing]?.kind !== SyntaxKind.CloseBraceToken ||
      body[closing + 1]?.kind !== SyntaxKind.CloseParenToken
    )
      return undefined;
    accounts.push(body[3].value);
  }
  return accounts.length === 1 ? accounts[0] : undefined;
}
