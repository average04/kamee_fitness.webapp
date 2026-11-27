import {beforeEach,describe,expect,it,vi} from 'vitest';

const harness=vi.hoisted(()=>({portal:vi.fn(),rpc:vi.fn(),server:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/portal-session',()=>({getPortalSession:harness.portal}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:harness.server}));
import {setIntroductionVideo} from '@/app/coaching/(hub)/profile/introduction-actions';

const owner='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const video='20000000-0000-4000-8000-000000000001';
function session(id=owner,role='coach',status='approved') {
  return {user:{id,email:'coach@example.invalid'},profileRole:role,coachStatus:status};
}
beforeEach(()=>{
  vi.clearAllMocks();
  harness.portal.mockResolvedValue(session());
  harness.rpc.mockResolvedValue({data:null,error:null});
  harness.server.mockResolvedValue({rpc:harness.rpc});
});

describe('expected-owner introduction action through real coach session reader',()=>{
  it.each([video,null])('uses only the request-scoped authenticated existing RPC for %s',async choice=>{
    expect(await setIntroductionVideo(owner,choice)).toEqual({ok:true});
    expect(harness.portal).toHaveBeenCalledOnce();
    expect(harness.server).toHaveBeenCalledOnce();
    expect(harness.rpc).toHaveBeenCalledExactlyOnceWith('set_coaching_intro_video',{p_video_id:choice});
  });
  it.each([video,null])('rejects stale account A UI while account B is authenticated for %s',async choice=>{
    harness.portal.mockResolvedValue(session(other));
    expect(await setIntroductionVideo(owner,choice)).toEqual({ok:false,error:expect.stringMatching(/session changed/i)});
    expect(harness.server).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });
  it('rejects an anonymous or no-longer-verifiable account before mutation client creation',async()=>{
    harness.portal.mockResolvedValue(null);
    expect(await setIntroductionVideo(owner,null)).toEqual({ok:false,error:expect.stringMatching(/session changed/i)});
    expect(harness.server).not.toHaveBeenCalled();
  });
  it.each(['none','invited','onboarding','in_review','changes_requested','suspended','revoked'])('does not let lifecycle %s change an introduction',async status=>{
    harness.portal.mockResolvedValue(session(owner,'coach',status));
    expect(await setIntroductionVideo(owner,null)).toEqual({ok:false,error:expect.stringMatching(/approved coach/i)});
    expect(harness.server).not.toHaveBeenCalled();
  });
  it.each(['user','admin'])('does not infer coach authority from role %s plus an approved status',async role=>{
    harness.portal.mockResolvedValue(session(owner,role));
    expect(await setIntroductionVideo(owner,video)).toEqual({ok:false,error:expect.stringMatching(/approved coach/i)});
    expect(harness.server).not.toHaveBeenCalled();
  });
  it.each([['bad-owner',video],[owner,'bad-video'],[owner,undefined],[owner,{}]])('rejects malformed action arguments without a profile or mutation read',async(actor,choice)=>{
    expect(await setIntroductionVideo(actor as string,choice as string|null)).toEqual({ok:false,error:expect.stringMatching(/valid introduction/i)});
    expect(harness.portal).not.toHaveBeenCalled();
    expect(harness.server).not.toHaveBeenCalled();
  });
  it('does not claim success for backend rejection and keeps provider details private',async()=>{
    harness.rpc.mockResolvedValue({data:null,error:{message:'sensitive backend detail'}});
    expect(await setIntroductionVideo(owner,video)).toEqual({ok:false,error:'Could not update your introduction. Reload the videos and try again.'});
  });
  it('handles transport failure without claiming the new selection was saved',async()=>{
    harness.rpc.mockRejectedValue(new Error('sensitive backend detail'));
    expect(await setIntroductionVideo(owner,video)).toEqual({ok:false,error:'Could not update your introduction. Reload the videos and try again.'});
  });
  it('fails closed when verified role loading fails',async()=>{
    harness.portal.mockRejectedValue(new Error('profile provider detail'));
    expect(await setIntroductionVideo(owner,null)).toEqual({ok:false,error:'Could not update your introduction. Reload the videos and try again.'});
    expect(harness.server).not.toHaveBeenCalled();
  });
});
