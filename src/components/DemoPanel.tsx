import { useEffect, useState } from 'react';
import demo from '../fixtures/demo.json';
import { formatKoMD, formatSignedWonShort, formatWon, formatWonShort } from '../lib/format';
import { formatRateDelta } from '../lib/money';
import { watchSummary } from '../lib/watch';
import { currentRoute, useStore, type AppState } from '../state/store';

/**
 * 시연 영상용 단계 설명. 주소에 ?demo 가 있을 때만 폰 왼쪽에 뜬다 — 폰 안의 화면 글은 그대로 둔다.
 * 문구는 fixtures/demo.json, 금액·날짜는 지금 상태의 계산 결과에서 끼운다(문구에 숫자를 적지 않는다).
 */
export const DEMO = new URLSearchParams(window.location.search).has('demo');

interface Scene {
  key: string;
  title: string;
  body: string[];
  ref: string;
}

const SCENES = demo.scenes as Scene[];
/** 번호를 매기는 본 장면 — 화면 이름만으로 고른 일반 설명(fallback)은 번호가 없다 */
const NUMBERED = SCENES.filter((s) => s.key.includes(':') || s.key === 'hub' || s.key === 'analyzing');

function sceneKeys(state: AppState): string[] {
  const route = currentRoute(state);
  if (!route) return [`tab:${state.tab}`];
  if ('triggerId' in route) return [`${route.name}:${route.triggerId}`, route.name];
  return [route.name];
}

const pp = (x: number) => formatRateDelta(x).replace(/^[−+]/, '');

export function DemoPanel() {
  const { state, scenario, derived: d } = useStore();
  const keys = sceneKeys(state);
  const scene = keys.map((k) => SCENES.find((s) => s.key === k)).find(Boolean);
  const tapped = useTapMarker();
  if (!scene) return <TapMarker at={tapped} />;

  const watch = watchSummary(scenario);
  const three = d.horizon.points.find((p) => p.months === 3);
  const cap = d.capAdjustments[0];
  const values: Record<string, string> = {
    service: scenario.brand.service,
    bank: scenario.brand.bank,
    products: String(watch.productCount),
    links: String(watch.linkCount),
    savings: formatWonShort(d.savingsTotal.value),
    loss: formatWonShort(d.total.value),
    net: formatSignedWonShort(d.netAnnual.value),
    three: three ? formatWon(Math.abs(three.value.value)) : '',
    safeAfter: formatKoMD(d.timing.safeAfter.value),
    cap: cap ? pp(cap.cap.value) : '',
    capNominal: cap ? pp(Math.abs(cap.nominalDelta)) : '',
    capActual: cap ? pp(Math.abs(cap.actualDelta)) : '',
  };
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
  const no = NUMBERED.indexOf(scene);

  return (
    <>
      <aside className="demopanel" aria-live="polite">
        <p className="dhead">{fill(demo.header)}</p>
        <div className="dscene" key={scene.key}>
          {no >= 0 && (
            <span className="dno">
              {no + 1}
              <em> / {NUMBERED.length}</em>
            </span>
          )}
          <h2>{scene.title}</h2>
          {scene.body.map((b) => (
            <p key={b}>{fill(b)}</p>
          ))}
          {scene.ref && <span className="dref">{scene.ref}</span>}
        </div>
      </aside>
      <TapMarker at={tapped} />
    </>
  );
}

/** 녹화에는 커서가 찍히지 않는다 — 누른 자리에 원을 잠깐 그려 어디를 눌렀는지 보이게 한다 */
function useTapMarker() {
  const [at, setAt] = useState<{ x: number; y: number; n: number } | null>(null);
  useEffect(() => {
    let n = 0;
    const on = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY, n: ++n });
    window.addEventListener('pointerdown', on, true);
    return () => window.removeEventListener('pointerdown', on, true);
  }, []);
  return at;
}

function TapMarker({ at }: { at: { x: number; y: number; n: number } | null }) {
  if (!at) return null;
  return <span key={at.n} className="tapmark" style={{ left: at.x, top: at.y }} aria-hidden="true" />;
}
