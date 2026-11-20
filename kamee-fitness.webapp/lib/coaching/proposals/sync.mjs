// Copy only the canonical strict DTOs and pure participant API; never mobile ports.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
export function synchronize(appRoot, check = false) {
  const types = readFileSync(resolve(appRoot, 'src/lib/coaching/proposalTypes.ts'), 'utf8').replaceAll('\r\n', '\n');
  const api = readFileSync(resolve(appRoot, 'src/api/coachingProposals.ts'), 'utf8').replaceAll('\r\n', '\n');
  const header = '// Generated from the canonical app participant contract by proposals/sync.mjs. Do not edit.\n';
  const dto = header + types.replace("'../utf8ByteLength'", "'../conversation/generated/utf8ByteLength'")
    .replace("'./commerceTypes'", "'../conversation/generated/commerceTypes'")
    .replace("'./enrollmentTypes'", "'../conversation/generated/enrollmentTypes'")
    .replace("'./utcTimestamp'", "'../conversation/generated/utcTimestamp'").replaceAll('1n', 'BigInt(1)');
  const rpcStart = api.indexOf('const rpc = {'), rpcEnd = api.indexOf('type RpcRequest');
  const bodyStart = api.indexOf('export class CoachingProposalError'), bodyEnd = api.indexOf('export type CoachingProposalsApi');
  if ([rpcStart, rpcEnd, bodyStart, bodyEnd].some(n => n < 0)) throw Error('canonical_proposal_boundary_changed');
  const rpc = api.slice(rpcStart, rpcEnd).replace('as const satisfies Record<keyof ProposalInputs, keyof PublicFunctions>', 'as const');
  const pure = api.slice(bodyStart, bodyEnd).replace('actor: AccountScope;', 'actor: { userId: string };');
  const client = header + "import { utf8ByteLength } from '../conversation/generated/utf8ByteLength';\n" +
    "import { parseProposalAck, parseProposalConsent, parseProposalDetail, parseProposalEditTarget, parseProposalPage, parseProposalPreview, proposalInputs, type ProposalAction, type ProposalInputs } from './types';\n" + rpc +
    'type RpcRequest = (name: RpcName, args: Readonly<{ p_input: string }>, signal?: AbortSignal) => Promise<unknown>;\n' + pure +
    'export type CoachingProposalsApi = ReturnType<typeof createCoachingProposalsApi>;\n';
  const files = { 'types.ts': dto, 'api.ts': client };
  const pins = { schema: 1, canonical: { 'src/lib/coaching/proposalTypes.ts': hash(types), 'src/api/coachingProposals.ts': hash(api) },
    pureRegionSha256: hash(api.slice(bodyStart, bodyEnd)), generated: Object.fromEntries(Object.entries(files).map(([n, v]) => [n, hash(v)])) };
  files['source-pins.json'] = JSON.stringify(pins, null, 2) + '\n';
  for (const [name, content] of Object.entries(files)) {
    if (check) { if (readFileSync(resolve(here, name), 'utf8').replaceAll('\r\n', '\n') !== content) throw Error('proposal_mirror_drift:' + name); }
    else writeFileSync(resolve(here, name), content);
  }
  return pins;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (!(args.length === 2 || args.length === 3) || args[0] !== '--app-root' || (args[2] && args[2] !== '--check')) throw Error('Use --app-root <canonical-app> [--check]');
  synchronize(args[1], args[2] === '--check');
  console.log('Canonical proposal DTOs and pure API ' + (args[2] ? 'match.' : 'mirrored.'));
}
