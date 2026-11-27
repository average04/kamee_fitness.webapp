// Generated from src/lib/coaching/conversationController.ts; run the app sync-coaching-conversation-client script. Do not edit.
import type { ConversationActor, ConversationApi, ConversationIdTarget } from './conversationApi';
import {
  classifyConversationFailure,
  ConversationActivityCancelledError,
} from './conversationErrors';
import { enrollmentUuid } from './enrollmentTypes';
import {
  parseSendConversationInput,
  type ConversationAvailability,
  type ConversationMessage,
  type ConversationPage,
} from './conversationTypes';
import {
  parseConversationReportInput,
  type ConversationContext,
  type ConversationPolicy,
  type ConversationReportCategory,
} from './conversationBackendTypes';
import type {
  ConversationJournal,
  ConversationJournalState,
  PendingConversationSend,
  PendingConversationReport,
} from './conversationJournalCore';

export type ConversationDelivery =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'not_sent'
  | 'checking'
  | 'unknown';
export type ConversationReportFeedback = Exclude<ConversationDelivery, 'unknown'> | 'unconfirmed';
export type ConversationBlockFeedback =
  | 'idle'
  | 'sending'
  | 'blocked'
  | 'unblocked'
  | 'unconfirmed';
export interface ConversationWindow {
  headBeforeSequence: string | null;
  pageCount: number;
  nextBeforeSequence: string | null;
  pinned: boolean;
}
export interface ConversationSnapshot {
  availability: ConversationAvailability | null;
  policy: ConversationPolicy | null;
  context: (ConversationContext & { incomplete: boolean }) | null;
  messages: ConversationMessage[];
  window: ConversationWindow;
  newerAvailable: boolean;
  draft: string;
  draftSaved: boolean;
  journalReady: boolean;
  roleMismatch: boolean;
  delivery: ConversationDelivery;
  pendingSend: PendingConversationSend | null;
  pendingReport: PendingConversationReport | null;
  reportFeedback: ConversationReportFeedback;
  blockFeedback: ConversationBlockFeedback;
  failedSendBody: string | null;
  unknownSendBody: string | null;
  authorityPaused: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  ready: boolean;
  retired: boolean;
}
export interface ConversationController {
  getSnapshot(): ConversationSnapshot;
  subscribe(listener: () => void): () => void;
  setActive(active: boolean): void;
  setAuthorityPaused(paused: boolean): void;
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  pinHistory(): void;
  loadOlder(): Promise<void>;
  returnToLatest(): Promise<void>;
  setDraft(body: string): Promise<void>;
  sendDraft(): Promise<void>;
  retryDelivery(): Promise<void>;
  stopCheckingDelivery(): Promise<void>;
  dismissFailedSend(): Promise<void>;
  dismissUnknownSend(): Promise<void>;
  open(reviewedPolicy?: ConversationPolicy | null): Promise<void>;
  confirmConsent(reviewedPolicy?: ConversationPolicy | null): Promise<void>;
  suspend(): Promise<void>;
  block(blocked: boolean): Promise<void>;
  report(messageIds: string[], category: ConversationReportCategory): Promise<void>;
  retryReport(): Promise<void>;
  markVisible(sequence: string): Promise<void>;
  dispose(): void;
}
interface Options {
  actor: ConversationActor;
  attemptId: string;
  api(): Promise<ConversationApi>;
  journal: ConversationJournal;
  newRequestId(): string;
  subscribeBoundary(listener: () => void): () => void;
  expectedViewerRole?: 'buyer' | 'coach';
}
const MAX_INT64 = BigInt('9223372036854775807');
const initial = (): ConversationSnapshot => ({
  availability: null,
  policy: null,
  context: null,
  messages: [],
  window: { headBeforeSequence: null, pageCount: 0, nextBeforeSequence: null, pinned: false },
  newerAvailable: false,
  draft: '',
  draftSaved: true,
  journalReady: false,
  roleMismatch: false,
  delivery: 'idle',
  pendingSend: null,
  pendingReport: null,
  reportFeedback: 'idle',
  blockFeedback: 'idle',
  failedSendBody: null,
  unknownSendBody: null,
  authorityPaused: false,
  loading: false,
  busy: false,
  error: null,
  ready: false,
  retired: false,
});
function errorText(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = {
    invalid_message: 'Enter a plain-text message of 1–2,000 characters.',
    journal_not_ready: 'Draft recovery is not ready. Retry before editing or sending.',
    policy_changed: 'The sharing details changed. Review them and confirm again.',
    policy_unavailable: 'The sharing details are unavailable. Retry before confirming.',
    conversation_role_mismatch: 'This conversation is unavailable for this account.',
    conversation_unavailable: 'This conversation is not currently available for that action.',
    conversation_authority_unconfirmed:
      'Conversation access could not be confirmed. Retry the action.',
    verification_unavailable:
      'Your account could not be verified. Check your connection and retry.',
    unknown_copy_requires_dismissal:
      'Keep or dismiss the previous unknown-delivery copy before stopping another check.',
    failed_copy_requires_dismissal:
      'Keep or dismiss the earlier unsent copy before sending another message.',
    invalid_journal:
      'Saved draft and delivery recovery could not be read. History is still available.',
  };
  return messages[code] ?? 'The request could not be completed. Try again.';
}

export function createConversationController(options: Options): ConversationController {
  const attemptId = enrollmentUuid.parse(options.attemptId);
  const originalAccount = options.actor.accountId,
    originalRevision = options.actor.revision;
  let snapshot = initial();
  const listeners = new Set<() => void>();
  let generation = 0,
    refreshGeneration = 0,
    draftGeneration = 0;
  let mutationTail: Promise<void> = Promise.resolve();
  const deliveryFlights: Record<'send' | 'report', Promise<void> | null> = {
    send: null,
    report: null,
  };
  let pages: ConversationPage[] = [];
  let active = false,
    activityGeneration = 0,
    readSequence = BigInt(0),
    uncertainSend = false,
    uncertainReport = false;
  let unsubscribe = () => {};
  let journalInitialized = false;
  let initializeFlight: Promise<void> | null = null;
  function publish(change: Partial<ConversationSnapshot>) {
    if (snapshot.retired) return;
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  }
  function retire() {
    if (snapshot.retired) return;
    generation++;
    refreshGeneration++;
    draftGeneration++;
    active = false;
    pages = [];
    snapshot = { ...initial(), retired: true };
    listeners.forEach((listener) => listener());
    unsubscribe();
  }
  function check(expected = generation) {
    if (snapshot.retired || expected !== generation) throw new Error('account_changed');
    try {
      options.actor.assertCurrent();
      if (
        options.actor.accountId !== originalAccount ||
        options.actor.revision !== originalRevision
      )
        throw new Error('account_changed');
    } catch (error) {
      retire();
      throw error;
    }
  }
  async function boundary<T>(promise: Promise<T>, expected = generation): Promise<T> {
    try {
      const result = await promise;
      check(expected);
      return result;
    } catch (error) {
      check(expected);
      throw error;
    }
  }
  function currentTarget(): ConversationIdTarget {
    const conversationId = snapshot.availability?.conversationId;
    if (!conversationId) throw new Error('conversation_unavailable');
    return { enrollmentAttemptId: attemptId, conversationId };
  }
  function queue(
    work: () => Promise<void>,
    localOnly = false,
    preserveError = false,
  ): Promise<void> {
    const scope = generation;
    const result = mutationTail
      .catch(() => {})
      .then(async () => {
        try {
          check(scope);
          if (!localOnly && snapshot.authorityPaused) throw new Error('verification_unavailable');
          publish({ busy: true, ...(!preserveError ? { error: null } : {}) });
          await work();
          check(scope);
        } catch (error) {
          if (!snapshot.retired) publish({ error: errorText(error) });
        } finally {
          if (!snapshot.retired) publish({ busy: false });
        }
      });
    mutationTail = result;
    return result;
  }
  function deliveryOperation(kind: 'send' | 'report', work: () => Promise<void>): Promise<void> {
    const existing = deliveryFlights[kind];
    if (existing) return existing;
    const result: Promise<void> = queue(work).finally(() => {
      if (deliveryFlights[kind] === result) deliveryFlights[kind] = null;
    });
    deliveryFlights[kind] = result;
    return result;
  }
  function applyJournal(state: ConversationJournalState, updateDraft = true) {
    publish({
      ...(updateDraft ? { draft: state.draft, draftSaved: true } : {}),
      pendingSend: state.pendingSend,
      pendingReport: state.pendingReport,
      failedSendBody: state.failedSendBody,
      unknownSendBody: state.unknownSendBody,
    });
  }
  function flatten(result: ConversationPage[]): ConversationMessage[] {
    const ids = new Set<string>(),
      sequences = new Set<string>();
    const messages = result
      .slice()
      .reverse()
      .flatMap((page) => page.messages);
    let previous = BigInt(0);
    for (const message of messages) {
      const sequence = BigInt(message.sequence);
      if (ids.has(message.id) || sequences.has(message.sequence) || sequence <= previous)
        throw new Error('invalid_history_window');
      ids.add(message.id);
      sequences.add(message.sequence);
      previous = sequence;
    }
    return messages;
  }
  async function rebuild(
    api: ConversationApi,
    target: ConversationIdTarget,
    head: string | null,
    count: number,
    valid: () => void,
  ): Promise<ConversationPage[]> {
    const result: ConversationPage[] = [];
    let before = head;
    for (let i = 0; i < count; i++) {
      const page = await boundary(api.history(target, before));
      valid();
      // API also validates each page. These checks protect injected ports and cross-page identity.
      if (
        page.accountId !== originalAccount ||
        page.enrollmentAttemptId !== attemptId ||
        page.conversationId !== target.conversationId
      )
        throw new Error('invalid_history_window');
      if (
        page.messages.length > 50 ||
        page.messages.some((m) => before !== null && BigInt(m.sequence) >= BigInt(before))
      )
        throw new Error('invalid_history_window');
      if (
        page.nextBeforeSequence !== null &&
        page.nextBeforeSequence !== page.messages[0]?.sequence
      )
        throw new Error('invalid_history_cursor');
      result.push(page);
      flatten(result);
      if (page.nextBeforeSequence === null) break;
      if (before !== null && BigInt(page.nextBeforeSequence) >= BigInt(before))
        throw new Error('invalid_history_cursor');
      before = page.nextBeforeSequence;
    }
    return result;
  }
  async function fetchContext(
    api: ConversationApi,
    availability: ConversationAvailability,
    valid: () => void,
  ): Promise<ConversationSnapshot['context']> {
    if (
      !availability.capabilities.canSend ||
      availability.controlRevision === null ||
      !availability.conversationId
    )
      return null;
    const target = { enrollmentAttemptId: attemptId, conversationId: availability.conversationId };
    let after: string | null = null;
    let first: ConversationContext | null = null;
    const days: NonNullable<ConversationContext['context']>['days'] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const page: ConversationContext = await boundary(api.context(target, after));
      valid();
      if (
        page.accountId !== originalAccount ||
        page.enrollmentAttemptId !== attemptId ||
        page.conversationId !== target.conversationId ||
        page.controlRevision !== availability.controlRevision
      )
        throw new Error('context_revision_changed');
      if (page.context === null) return null;
      first = first ?? page;
      if (
        first.context &&
        (first.context.planTitle !== page.context.planTitle ||
          first.context.buyerName !== page.context.buyerName ||
          first.context.coachName !== page.context.coachName)
      )
        throw new Error('invalid_context');
      for (const day of page.context.days) {
        if (seen.has(day.scheduleRowId) || (after !== null && day.scheduleRowId <= after))
          throw new Error('invalid_context_cursor');
        seen.add(day.scheduleRowId);
        days.push(day);
      }
      const next: string | null = page.context.nextAfterScheduleId;
      if (next !== null && next !== page.context.days[page.context.days.length - 1]?.scheduleRowId)
        throw new Error('invalid_context_cursor');
      if (next === null)
        return {
          ...first,
          context: {
            ...page.context,
            days: days.sort(
              (a, b) =>
                a.scheduledDate.localeCompare(b.scheduledDate) ||
                a.scheduleRowId.localeCompare(b.scheduleRowId),
            ),
            nextAfterScheduleId: null,
          },
          incomplete: false,
        };
      if (i === 3)
        return {
          ...first,
          context: { ...page.context, days: [], nextAfterScheduleId: next },
          incomplete: true,
        };
      after = next;
    }
    return null;
  }
  async function refreshWindow(override?: { head: string | null; count: number; pinned: boolean }) {
    if (snapshot.authorityPaused) return false;
    const scope = generation,
      flight = ++refreshGeneration;
    const valid = () => {
      check(scope);
      if (flight !== refreshGeneration) throw new Error('stale_refresh');
    };
    const head = override ? override.head : snapshot.window.headBeforeSequence;
    const count = override?.count ?? Math.max(1, snapshot.window.pageCount);
    const pinned = override?.pinned ?? snapshot.window.pinned;
    let apiCaptured = false;
    try {
      check(scope);
      publish({ loading: true });
      const api = await boundary(options.api(), scope);
      valid();
      apiCaptured = true;
      publish({ error: null });
      const availability = await boundary(api.availability(attemptId), scope);
      valid();
      if (options.expectedViewerRole && availability.viewerRole !== options.expectedViewerRole)
        throw new Error('conversation_role_mismatch');
      publish({
        availability,
        roleMismatch: false,
        ...(!availability.capabilities.canSend ||
        snapshot.context?.controlRevision !== availability.controlRevision
          ? { context: null }
          : {}),
        ...(!availability.capabilities.canReadHistory ? { messages: [] } : {}),
      });
      let policy: ConversationPolicy | null = null;
      try {
        policy = await boundary(api.policy(attemptId), scope);
        valid();
      } catch (error) {
        valid();
        publish({ error: errorText(error) });
      }
      if (!availability.capabilities.canReadHistory || !availability.conversationId) {
        pages = [];
        publish({
          policy,
          messages: [],
          context: null,
          ready: true,
          window: {
            headBeforeSequence: null,
            pageCount: 0,
            nextBeforeSequence: null,
            pinned: false,
          },
          newerAvailable: false,
        });
        return true;
      }
      const target = {
        enrollmentAttemptId: attemptId,
        conversationId: availability.conversationId,
      };
      const nextPages = await rebuild(api, target, head, count, valid);
      valid();
      let newerAvailable = false;
      if (pinned) {
        const newest = await boundary(api.history(target, null), scope);
        valid();
        const retainedMax = nextPages[0]?.messages[nextPages[0].messages.length - 1]?.sequence;
        newerAvailable = newest.messages.some(
          (message) => retainedMax === undefined || BigInt(message.sequence) > BigInt(retainedMax),
        );
      }
      let context: ConversationSnapshot['context'] = null;
      try {
        context = await fetchContext(api, availability, valid);
      } catch (error) {
        valid();
        publish({ error: errorText(error) });
      }
      valid();
      pages = nextPages;
      publish({
        policy,
        context,
        messages: flatten(pages),
        newerAvailable,
        ready: true,
        window: {
          headBeforeSequence: head,
          pageCount: pages.length,
          nextBeforeSequence: pages[pages.length - 1]?.nextBeforeSequence ?? null,
          pinned,
        },
      });
      return true;
    } catch (error) {
      if (!snapshot.retired && flight === refreshGeneration) {
        // A known cancellation before capture did not attempt a reader or invalidate its cache.
        if (!apiCaptured && error instanceof ConversationActivityCancelledError) return false;
        pages = [];
        publish({
          availability: null,
          policy: null,
          messages: [],
          context: null,
          ready: false,
          ...(error instanceof Error && error.message === 'conversation_role_mismatch'
            ? { roleMismatch: true }
            : {}),
          error: errorText(error),
        });
      }
      return false;
    } finally {
      if (!snapshot.retired && flight === refreshGeneration)
        publish({
          loading: false,
          ...(journalInitialized && !snapshot.journalReady && snapshot.error === null
            ? { error: errorText(new Error('invalid_journal')) }
            : {}),
        });
    }
  }
  async function confirmAuthority() {
    for (let retry = 0; retry < 2; retry++) {
      const expectedFlight = refreshGeneration + 1;
      if (await refreshWindow()) return;
      check();
      // Only a superseding read/pin gets one fresh preflight, never a failed write replay.
      if (snapshot.authorityPaused || refreshGeneration === expectedFlight) break;
    }
    throw new Error('conversation_authority_unconfirmed');
  }
  async function refreshAfterWrite() {
    if (active && !snapshot.authorityPaused) await refreshWindow();
  }
  async function dispatchSend(pending: PendingConversationSend, wasUncertain: boolean) {
    publish({ delivery: 'sending', pendingSend: pending });
    try {
      const api = await boundary(options.api());
      await boundary(
        api.send(
          { enrollmentAttemptId: attemptId, conversationId: pending.conversationId },
          pending.input,
        ),
      );
      const before = snapshot.draft;
      await boundary(options.journal.resolve(attemptId, 'send', pending.input.requestId, 'sent'));
      const state = await boundary(options.journal.read(attemptId));
      applyJournal(state, snapshot.draft === before && snapshot.draft === pending.input.body);
      uncertainSend = false;
      publish({ delivery: 'sent' });
      await refreshAfterWrite();
    } catch (error) {
      check();
      const outcome = classifyConversationFailure(error, 'send', wasUncertain);
      if (outcome === 'not_sent') {
        // A failed local removal must leave an explicitly recoverable saved request.
        publish({
          delivery: 'checking',
          ...(!(error instanceof ConversationActivityCancelledError) ? { context: null } : {}),
        });
        await boundary(
          options.journal.resolve(attemptId, 'send', pending.input.requestId, 'not_sent', {
            keepFailedCopy: snapshot.draft !== '' && snapshot.draft !== pending.input.body,
            restoreEmptyDraft: snapshot.draft === '',
          }),
        );
        const state = await boundary(options.journal.read(attemptId));
        applyJournal(state, snapshot.draft === '');
        uncertainSend = false;
        publish({ delivery: 'not_sent', error: errorText(error) });
        // A real rejection hides context above; focus revalidates any deferred authority read.
        await refreshAfterWrite();
      } else {
        uncertainSend = true;
        publish({
          delivery: 'checking',
          error:
            outcome === 'unconfirmed'
              ? 'Delivery could not be confirmed. The original request is saved for explicit recovery.'
              : errorText(error),
        });
      }
    }
  }
  async function dispatchReport(pending: PendingConversationReport, wasUncertain: boolean) {
    publish({ reportFeedback: 'sending', pendingReport: pending });
    try {
      const api = await boundary(options.api());
      await boundary(
        api.report(
          { enrollmentAttemptId: attemptId, conversationId: pending.conversationId },
          pending.input,
        ),
      );
      await boundary(options.journal.resolve(attemptId, 'report', pending.input.requestId, 'sent'));
      uncertainReport = false;
      publish({ pendingReport: null, reportFeedback: 'sent' });
    } catch (error) {
      check();
      const outcome = classifyConversationFailure(error, 'report', wasUncertain);
      if (outcome === 'not_sent') {
        publish({ reportFeedback: 'checking' });
        await boundary(
          options.journal.resolve(attemptId, 'report', pending.input.requestId, 'not_sent'),
        );
        publish({ pendingReport: null });
      } else uncertainReport = true;
      publish({ reportFeedback: outcome, error: errorText(error) });
    }
  }
  async function control(
    kind: 'open' | 'consent' | 'suspend',
    reviewedPolicy?: ConversationPolicy | null,
  ) {
    await confirmAuthority();
    check();
    const api = await boundary(options.api());
    const availability = snapshot.availability;
    if (!availability) throw new Error('conversation_unavailable');
    const base = { enrollmentAttemptId: attemptId, requestId: options.newRequestId() };
    try {
      let ack;
      if (kind === 'open' || kind === 'consent') {
        const policy = snapshot.policy;
        if (!policy) throw new Error('policy_unavailable');
        if (
          !reviewedPolicy ||
          ['policyVersion', 'contentHash', 'body', 'coachName'].some(
            (key) =>
              policy[key as keyof ConversationPolicy] !==
              reviewedPolicy[key as keyof ConversationPolicy],
          )
        )
          throw new Error('policy_changed');
        const input = {
          ...base,
          policyVersion: policy.policyVersion,
          contentHash: policy.contentHash,
        };
        ack =
          kind === 'open'
            ? await boundary(api.open(input))
            : await boundary(
                api.consent(currentTarget(), {
                  ...input,
                  expectedControlRevision: availability.controlRevision!,
                }),
              );
      } else
        ack = await boundary(
          api.suspend(currentTarget(), {
            ...base,
            expectedControlRevision: availability.controlRevision!,
          }),
        );
      refreshGeneration++;
      publish({
        availability: ack.availability,
        context: null,
        ...(!ack.availability.capabilities.canReadHistory ? { messages: [] } : {}),
      });
      await refreshAfterWrite();
    } catch (error) {
      refreshGeneration++;
      publish({ availability: null, context: null, messages: [], ready: false, loading: false });
      throw error;
    }
  }
  const controller: ConversationController = {
    getSnapshot() {
      try {
        check();
      } catch {}
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setActive(value) {
      try {
        check();
        if (active !== value) activityGeneration++;
        active = value && !snapshot.authorityPaused;
      } catch {}
    },
    setAuthorityPaused(paused) {
      check();
      if (snapshot.authorityPaused === paused) return;
      refreshGeneration++;
      if (paused) {
        active = false;
        activityGeneration++;
        pages = [];
        publish({
          authorityPaused: true,
          availability: null,
          policy: null,
          context: null,
          messages: [],
          ready: false,
          loading: false,
          error: errorText(new Error('verification_unavailable')),
        });
      } else publish({ authorityPaused: false, error: null });
    },
    initialize() {
      if (snapshot.authorityPaused || snapshot.retired) return Promise.resolve();
      if (initializeFlight) return initializeFlight;
      if (journalInitialized) return refreshWindow().then(() => {});
      initializeFlight = (async () => {
        const draftVersion = draftGeneration;
        let journalError: unknown = null;
        try {
          check();
          const state = await boundary(options.journal.read(attemptId));
          applyJournal(state, draftVersion === draftGeneration && snapshot.draftSaved);
          uncertainSend = state.pendingSend !== null;
          uncertainReport = state.pendingReport !== null;
          publish({
            journalReady: true,
            delivery: state.pendingSend ? 'checking' : state.unknownSendBody ? 'unknown' : 'idle',
            reportFeedback: state.pendingReport ? 'checking' : 'idle',
          });
        } catch (error) {
          journalError = error;
        }
        if (snapshot.retired) return;
        journalInitialized =
          !journalError ||
          (journalError instanceof Error && journalError.message === 'invalid_journal');
        await refreshWindow();
        if (journalError && !snapshot.retired)
          publish({
            error: journalInitialized
              ? errorText(journalError)
              : 'Saved draft and delivery recovery could not be read. Retry before editing.',
          });
      })().finally(() => {
        initializeFlight = null;
      });
      return initializeFlight;
    },
    refresh: async () => {
      if (!journalInitialized) await controller.initialize();
      else await refreshWindow();
    },
    pinHistory() {
      try {
        check();
        if (snapshot.window.pinned || !snapshot.messages.length) return;
        const highest = BigInt(snapshot.messages[snapshot.messages.length - 1]!.sequence);
        refreshGeneration++;
        publish({
          window: {
            ...snapshot.window,
            headBeforeSequence: highest === MAX_INT64 ? null : String(highest + BigInt(1)),
            pinned: true,
          },
          loading: false,
        });
      } catch {}
    },
    loadOlder: () =>
      queue(async function loadOlderPage(retries = 1): Promise<void> {
        if (snapshot.authorityPaused) throw new Error('verification_unavailable');
        controller.pinHistory();
        if (!snapshot.window.nextBeforeSequence) return;
        const head = snapshot.window.headBeforeSequence,
          count = Math.min(5, snapshot.window.pageCount + 1),
          scope = generation,
          flight = ++refreshGeneration;
        const valid = () => {
          check(scope);
          if (flight !== refreshGeneration) throw new Error('stale_refresh');
        };
        let apiCaptured = false;
        publish({ loading: true });
        try {
          const api = await boundary(options.api());
          valid();
          apiCaptured = true;
          publish({ error: null });
          const availability = await boundary(api.availability(attemptId));
          valid();
          if (options.expectedViewerRole && availability.viewerRole !== options.expectedViewerRole)
            throw new Error('conversation_role_mismatch');
          const context =
            availability.capabilities.canSend &&
            snapshot.context?.controlRevision === availability.controlRevision
              ? snapshot.context
              : null;
          publish({ availability, context, roleMismatch: false });
          if (!availability.capabilities.canReadHistory || !availability.conversationId) {
            pages = [];
            publish({
              messages: [],
              context: null,
              window: {
                headBeforeSequence: null,
                pageCount: 0,
                nextBeforeSequence: null,
                pinned: false,
              },
              newerAvailable: false,
            });
            return;
          }
          const result = await rebuild(
            api,
            { enrollmentAttemptId: attemptId, conversationId: availability.conversationId },
            head,
            count,
            valid,
          );
          valid();
          let nextHead = head;
          if (result.length > 4) {
            nextHead = result[0]!.nextBeforeSequence;
            result.shift();
          }
          pages = result;
          publish({
            availability,
            context,
            messages: flatten(pages),
            window: {
              headBeforeSequence: nextHead,
              pageCount: pages.length,
              nextBeforeSequence: pages[pages.length - 1]?.nextBeforeSequence ?? null,
              pinned: true,
            },
            newerAvailable: snapshot.newerAvailable || nextHead !== head,
          });
        } catch (error) {
          if (!apiCaptured && error instanceof ConversationActivityCancelledError) return;
          if (
            !snapshot.retired &&
            !snapshot.authorityPaused &&
            flight !== refreshGeneration &&
            retries > 0
          )
            return loadOlderPage(retries - 1);
          if (!snapshot.retired && flight === refreshGeneration) {
            pages = [];
            publish({
              availability: null,
              policy: null,
              messages: [],
              context: null,
              error: errorText(error),
              ...(error instanceof Error && error.message === 'conversation_role_mismatch'
                ? { roleMismatch: true }
                : {}),
            });
          }
        } finally {
          if (!snapshot.retired && flight === refreshGeneration) publish({ loading: false });
        }
      }),
    returnToLatest: async () => {
      await refreshWindow({ head: null, count: 1, pinned: false });
    },
    async setDraft(body) {
      try {
        check();
        if (!snapshot.journalReady) {
          publish({ error: errorText(new Error('journal_not_ready')) });
          return;
        }
      } catch {
        return;
      }
      const revision = ++draftGeneration;
      try {
        check();
        publish({ draft: body, draftSaved: false });
        if (body.length > 16000) {
          publish({ error: 'Draft is too long to save locally. Copy it before leaving.' });
          return;
        }
        await boundary(options.journal.saveDraft(attemptId, body));
        if (revision === draftGeneration) publish({ draftSaved: true });
      } catch (error) {
        if (!snapshot.retired && revision === draftGeneration)
          publish({ draftSaved: false, error: errorText(error) });
      }
    },
    sendDraft: () => {
      const body = snapshot.draft;
      const revision = draftGeneration;
      return deliveryOperation('send', async () => {
        if (snapshot.pendingSend) return;
        publish({ delivery: 'sending' });
        let pending: PendingConversationSend;
        try {
          if (!snapshot.journalReady) throw new Error('journal_not_ready');
          await confirmAuthority();
          check();
          const availability = snapshot.availability;
          if (!availability?.capabilities.canSend || !availability.controlRevision)
            throw new Error('conversation_unavailable');
          const target = currentTarget();
          let input: ReturnType<typeof parseSendConversationInput>;
          try {
            input = parseSendConversationInput({
              enrollmentAttemptId: attemptId,
              requestId: options.newRequestId(),
              expectedControlRevision: availability.controlRevision,
              body,
            });
          } catch {
            throw new Error('invalid_message');
          }
          // Repair a failed save only while this exact visible draft is still current.
          if (revision === draftGeneration && !snapshot.draftSaved) {
            await boundary(options.journal.saveDraft(attemptId, body));
            if (revision === draftGeneration) publish({ draftSaved: true });
          }
          pending = await boundary(options.journal.prepareSend(target, input));
        } catch (error) {
          check();
          // Preflight and durable preparation cannot have submitted an HTTP mutation.
          publish({ delivery: 'not_sent', error: errorText(error) });
          return;
        }
        await dispatchSend(pending, false);
      });
    },
    retryDelivery: () =>
      deliveryOperation('send', async () => {
        if (snapshot.pendingSend) await dispatchSend(snapshot.pendingSend, uncertainSend);
      }),
    stopCheckingDelivery: () =>
      queue(async () => {
        const pending = snapshot.pendingSend;
        if (!pending) return;
        await boundary(options.journal.abandonSend(attemptId, pending.input.requestId));
        applyJournal(await boundary(options.journal.read(attemptId)), false);
        uncertainSend = false;
        publish({ delivery: 'unknown' });
      }, true),
    dismissFailedSend: () =>
      queue(async () => {
        await boundary(options.journal.dismissSendCopy(attemptId, 'failed'));
        applyJournal(await boundary(options.journal.read(attemptId)), false);
      }, true),
    dismissUnknownSend: () =>
      queue(async () => {
        await boundary(options.journal.dismissSendCopy(attemptId, 'unknown'));
        applyJournal(await boundary(options.journal.read(attemptId)), false);
        if (snapshot.delivery === 'unknown') publish({ delivery: 'idle' });
      }, true),
    open: (reviewedPolicy = snapshot.policy) => queue(() => control('open', reviewedPolicy)),
    confirmConsent: (reviewedPolicy = snapshot.policy) =>
      queue(() => control('consent', reviewedPolicy)),
    suspend: () => queue(() => control('suspend')),
    block: (blocked) =>
      queue(async () => {
        const target = currentTarget();
        publish({ blockFeedback: 'sending' });
        try {
          const api = await boundary(options.api());
          await boundary(api.block(target, blocked));
          refreshGeneration++;
          publish({ blockFeedback: blocked ? 'blocked' : 'unblocked', context: null });
          await refreshAfterWrite();
        } catch (error) {
          check();
          refreshGeneration++;
          publish({
            blockFeedback: 'unconfirmed',
            context: null,
            loading: false,
            error:
              'The block change could not be confirmed. Choose Block or Unblock explicitly to try again.',
          });
        }
      }),
    report: (messageIds, category) =>
      deliveryOperation('report', async () => {
        if (snapshot.pendingReport) return;
        publish({ reportFeedback: 'sending' });
        let pending: PendingConversationReport;
        try {
          const input = parseConversationReportInput({
            enrollmentAttemptId: attemptId,
            requestId: options.newRequestId(),
            messageIds,
            category,
          });
          pending = await boundary(options.journal.prepareReport(currentTarget(), input));
        } catch {
          check();
          // No HTTP dispatch has occurred. A prior report's success cannot describe this selection.
          publish({
            reportFeedback: 'not_sent',
            error: 'Report was not submitted. Your selection is unchanged. Try again.',
          });
          return;
        }
        await dispatchReport(pending, false);
      }),
    retryReport: () =>
      deliveryOperation('report', async () => {
        if (snapshot.pendingReport) await dispatchReport(snapshot.pendingReport, uncertainReport);
      }),
    markVisible: (sequence) => {
      if (!active) return Promise.resolve();
      try {
        if (BigInt(sequence) <= readSequence) return Promise.resolve();
      } catch {
        return Promise.resolve();
      }
      const focus = activityGeneration;
      return queue(
        async () => {
          if (
            !active ||
            focus !== activityGeneration ||
            !snapshot.availability?.capabilities.canReadHistory ||
            !snapshot.messages.some((message) => message.sequence === sequence)
          )
            return;
          const value = BigInt(sequence);
          if (value <= readSequence) return;
          let api: ConversationApi;
          try {
            api = await boundary(options.api());
          } catch (error) {
            if (error instanceof ConversationActivityCancelledError) return;
            throw error;
          }
          if (!active || focus !== activityGeneration) return;
          const ack = await boundary(
            api.markRead(currentTarget(), {
              enrollmentAttemptId: attemptId,
              requestId: options.newRequestId(),
              sequence,
            }),
          );
          if (BigInt(ack.lastReadSequence) > readSequence)
            readSequence = BigInt(ack.lastReadSequence);
        },
        false,
        true,
      );
    },
    dispose: retire,
  };
  unsubscribe = options.subscribeBoundary(retire);
  if (snapshot.retired) unsubscribe();
  return controller;
}
