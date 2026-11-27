// Generated from the canonical app participant contract by proposals/sync.mjs. Do not edit.
import { utf8ByteLength } from '../conversation/generated/utf8ByteLength';
import { parseProposalAck, parseProposalConsent, parseProposalDetail, parseProposalEditTarget, parseProposalPage, parseProposalPreview, proposalInputs, type ProposalAction, type ProposalInputs } from './types';
const rpc = {
  consent: 'get_coaching_proposal_consent',
  setConsent: 'set_coaching_proposal_consent',
  editTargets: 'get_coaching_proposal_edit_targets',
  preview: 'preview_coaching_proposal',
  getPreview: 'get_coaching_proposal_preview',
  send: 'send_coaching_proposal',
  accept: 'accept_coaching_proposal',
  decline: 'decline_coaching_proposal',
  withdraw: 'withdraw_coaching_proposal',
  getProposal: 'get_coaching_proposal',
  list: 'list_coaching_proposals',
} as const;
type RpcName = (typeof rpc)[keyof typeof rpc];
type RpcRequest = (name: RpcName, args: Readonly<{ p_input: string }>, signal?: AbortSignal) => Promise<unknown>;
export class CoachingProposalError extends Error {
  constructor(readonly code: string, readonly status = 0) {
    super('Proposal request failed.');
    this.name = 'CoachingProposalError';
  }
}

function checkSignal(signal?: AbortSignal) {
  if (signal?.aborted) throw new CoachingProposalError('request_cancelled');
}

function waitForRetry(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    checkSignal(signal);
    function done() {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }
    function cancel() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new CoachingProposalError('request_cancelled'));
    }
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

export function createCoachingProposalsApi({ actor, assertCurrent, request, wait = waitForRetry }: {
  actor: { userId: string };
  assertCurrent(): void;
  request: RpcRequest;
  wait?: typeof waitForRetry;
}) {
  const accountId = actor.userId;

  async function call<T>(name: RpcName, value: unknown, parse: (raw: unknown) => T, signal?: AbortSignal) {
    const p_input = JSON.stringify(value);
    if (utf8ByteLength(p_input) > 262144) throw new CoachingProposalError('PT400', 400);
    const args = Object.freeze({ p_input });
    let raw: unknown;
    for (let attempt = 0; ; attempt += 1) {
      assertCurrent();
      checkSignal(signal);
      try {
        raw = await request(name, args, signal);
        break;
      } catch (error) {
        assertCurrent();
        checkSignal(signal);
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if (code !== 'PT503' || attempt >= 2) throw error;
        await wait((attempt === 0 ? 100 : 300) + Math.floor(Math.random() * 100), signal);
      }
    }
    assertCurrent();
    checkSignal(signal);
    const result = parse(raw);
    assertCurrent();
    checkSignal(signal);
    return result;
  }

  function mutate<Action extends ProposalAction>(
    name: RpcName, action: Action,
    value: ProposalInputs['setConsent' | 'preview' | 'send' | 'accept' | 'decline' | 'withdraw'],
    signal?: AbortSignal,
  ) {
    return call(name, value, raw => parseProposalAck(raw, action, accountId, value), signal);
  }

  return {
    consent(input: ProposalInputs['consent'], signal?: AbortSignal) {
      const value = proposalInputs.consent.parse(input);
      return call(rpc.consent, value, raw => parseProposalConsent(raw, value, accountId), signal);
    },
    setConsent(input: ProposalInputs['setConsent'], signal?: AbortSignal) {
      const value = proposalInputs.setConsent.parse(input);
      return mutate(rpc.setConsent, value.action === 'accept' ? 'consent_accept' : 'consent_revoke', value, signal);
    },
    editTargets(input: ProposalInputs['editTargets'], signal?: AbortSignal) {
      const value = proposalInputs.editTargets.parse(input);
      return call(rpc.editTargets, value, raw => parseProposalEditTarget(raw, value), signal);
    },
    preview(input: ProposalInputs['preview'], signal?: AbortSignal) {
      return mutate(rpc.preview, 'preview', proposalInputs.preview.parse(input), signal);
    },
    getPreview(input: ProposalInputs['getPreview'], signal?: AbortSignal) {
      const value = proposalInputs.getPreview.parse(input);
      return call(rpc.getPreview, value, raw => parseProposalPreview(raw, value), signal);
    },
    send(input: ProposalInputs['send'], signal?: AbortSignal) {
      return mutate(rpc.send, 'send', proposalInputs.send.parse(input), signal);
    },
    accept(input: ProposalInputs['accept'], signal?: AbortSignal) {
      return mutate(rpc.accept, 'accept', proposalInputs.accept.parse(input), signal);
    },
    decline(input: ProposalInputs['decline'], signal?: AbortSignal) {
      return mutate(rpc.decline, 'decline', proposalInputs.decline.parse(input), signal);
    },
    withdraw(input: ProposalInputs['withdraw'], signal?: AbortSignal) {
      return mutate(rpc.withdraw, 'withdraw', proposalInputs.withdraw.parse(input), signal);
    },
    getProposal(input: ProposalInputs['getProposal'], signal?: AbortSignal) {
      const value = proposalInputs.getProposal.parse(input);
      return call(rpc.getProposal, value, raw => parseProposalDetail(raw, value, value.proposalId), signal);
    },
    list(input: ProposalInputs['list'], signal?: AbortSignal) {
      const value = proposalInputs.list.parse(input);
      return call(rpc.list, value, raw => parseProposalPage(raw, value), signal);
    },
  };
}

export type CoachingProposalsApi = ReturnType<typeof createCoachingProposalsApi>;
