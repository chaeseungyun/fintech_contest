// 화면 렌더 스모크. 계산은 lib 테스트가 본다 — 여기는 "그려지다 터지지 않는가" 만 본다.
// 발표 중 흰 화면이 뜨는 사고를 막는 최소한의 그물이다. jsdom 없이 문자열로 그린다.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionPlan } from './ActionPlan';
import { Assets } from './Assets';
import { Benefits } from './Benefits';
import { Connections } from './Connections';
import { Evidence } from './Evidence';
import { Home } from './Home';
import { Hub } from './Hub';
import { Impact } from './Impact';
import { More } from './More';
import { Timeline } from './Timeline';
import { Verdict } from './Verdict';
import { BASE_SCENARIO } from '../state/store';
import { initialState, reducer, select, StoreContext, type Action, type AppState } from '../state/store';

function draw(node: ReactElement, actions: Action[] = []): string {
  let state: AppState = initialState();
  for (const a of actions) state = reducer(state, a);
  const { scenario, derived } = select(state);
  return renderToString(
    <StoreContext.Provider value={{ state, scenario, derived, dispatch: () => {} }}>
      {node}
    </StoreContext.Provider>,
  );
}

const TRIGGERS = BASE_SCENARIO.triggers.map((t) => t.id);

describe('화면 스모크', () => {
  it('홈', () => {
    const html = draw(<Home />);
    expect(html).toContain('FinStay AI');
    expect(html).toContain('상시 분석 중');
    expect(html).toContain('이번 달 점검');
    expect(html).not.toContain('SwitchPoint');
  });

  it('탭 화면들', () => {
    for (const node of [<Assets key="a" />, <Benefits key="b" />, <More key="m" />]) {
      const html = draw(node);
      expect(html.length).toBeGreaterThan(200);
      expect(html).not.toContain('SwitchPoint');
    }
    expect(draw(<More />)).toContain('FinStay AI');
    expect(draw(<Benefits />)).toContain('더하면 이득인 상품');
  });

  it('허브', () => {
    const html = draw(<Hub />);
    expect(html).toContain('상시 분석');
    expect(html).toContain('손익을 따져볼 항목');
    // 트리거마다 한 행. 판단이 끝나기 전에는 실행 안내 문구가 없다
    expect((html.match(/triggerrow/g) ?? []).length).toBe(BASE_SCENARIO.triggers.length);
  });

  for (const triggerId of TRIGGERS) {
    it(`분석 흐름 — ${triggerId}`, () => {
      const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId } }];
      const impact = draw(<Impact triggerId={triggerId} />, open);
      const verdict = draw(<Verdict triggerId={triggerId} />, open);
      const plan = draw(<ActionPlan triggerId={triggerId} />, open);
      const timeline = draw(<Timeline />, open);
      const conn = draw(<Connections triggerId={triggerId} />, open);
      for (const html of [impact, verdict, plan, timeline, conn]) {
        expect(html.length).toBeGreaterThan(300);
      }
      expect(plan).toContain('실행 안내');
      expect(verdict).toMatch(/절차 (보기|안내받기)/);
      expect(verdict).not.toContain('해지합니다');
    });
  }

  it('근거 화면', () => {
    const triggerId = 'card_cancel';
    const productId = 'loan_nuri_mortgage';
    const html = draw(<Evidence triggerId={triggerId} productId={productId} />, [
      { type: 'push', route: { name: 'evidence', triggerId, productId } },
    ]);
    expect(html.length).toBeGreaterThan(300);
  });

  it('예·적금 해지는 중도해지 이자를 영향 화면과 실행 안내에서만 보여준다', () => {
    const open: Action[] = [{ type: 'push', route: { name: 'verdict', triggerId: 'deposit_cancel' } }];
    expect(draw(<Impact triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    expect(draw(<ActionPlan triggerId="deposit_cancel" />, open)).toContain('중도해지 이자 손실');
    // 판단 화면에는 별도 카드가 없다 (트리거 caveat 문장은 데이터라 남는다)
    expect(draw(<Verdict triggerId="deposit_cancel" />, open)).not.toContain('만기까지 두면');
  });
});
