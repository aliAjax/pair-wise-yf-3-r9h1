import { useState } from 'react';
import { X, Check, GitMerge, ChevronRight, ChevronLeft, AlertTriangle, Crown, Hash } from 'lucide-react';
import type { SmellMemory } from '../utils/constants';
import { getSmellTypeInfo } from '../utils/constants';
import type { MemorySnapshot } from '../utils/helpers';
import { canMergeMemories, pickPrimary, snapshotMemory } from '../utils/helpers';
import type { MergeResult } from '../store/memoryStore';

interface Props {
  selected: SmellMemory[];
  onCancel: () => void;
  onCommit: (snapshots: [MemorySnapshot, MemorySnapshot]) => MergeResult;
}

export default function MergeBar({ selected, onCancel, onCommit }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  const ready = selected.length === 2 && canMergeMemories(selected[0], selected[1]);
  const mismatched = selected.length === 2 && !ready;
  const need = 2 - selected.length;

  const handleConfirm = () => {
    const result = onCommit([snapshotMemory(selected[0]), snapshotMemory(selected[1])]);
    if (result.ok) {
      setShowConfirm(false);
    }
  };

  return (
    <section className="container max-w-6xl mb-4">
      <div className="rounded-2xl border-2 border-ochre-400 bg-ochre-100/70 backdrop-blur shadow-paper p-4 md:p-5 animate-fadeInUp">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:w-36 shrink-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-ochre-500 text-paper-50">
              <GitMerge className="w-4 h-4" />
            </span>
            <div>
              <div className="font-hand text-lg leading-tight text-ochre-600">合并重复记录</div>
              <div className="text-[11px] text-ink-700/55">已勾选 {selected.length}/2 条</div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selected.length === 0 && (
              <p className="text-sm text-ink-700/70">
                请勾选两条地点与气味类型一致的记录，正文将并入更新时间较新的一条。
              </p>
            )}
            {selected.length === 1 && (
              <p className="text-sm text-ink-700/70">
                再勾选 <b className="text-ochre-600">1 条</b> 记录即可检查能否合并。
              </p>
            )}
            {mismatched && (
              <p className="inline-flex items-start gap-1.5 text-sm text-brick-600 font-medium">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  两条记录无法合并：地点「{selected[0].location}」/「{selected[1].location}」
                  或气味类型
                  {getSmellTypeInfo(selected[0].smell_type).label}/
                  {getSmellTypeInfo(selected[1].smell_type).label}
                  不一致。请重新勾选。
                </span>
              </p>
            )}
            {ready && !showConfirm && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-sm text-moss-600 font-medium">
                  <Check className="w-4 h-4" />
                  地点与气味类型一致，可以合并
                </span>
                <span className="text-xs text-ink-700/55">
                  （主记录：「{pickPrimary(selected[0], selected[1]).location}」更新时间较新者）
                </span>
              </div>
            )}
          </div>

          {!showConfirm && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onCancel} className="btn-secondary !py-2 text-sm">
                <X className="w-4 h-4 mr-1" /> 取消
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={need > 0 || mismatched}
                className={`btn-primary !py-2 text-sm ${
                  need > 0 || mismatched ? 'opacity-40 cursor-not-allowed hover:translate-y-0' : ''
                }`}
                title={need > 0 ? `还需勾选 ${need} 条` : mismatched ? '地点或气味类型不一致' : undefined}
              >
                下一步 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {showConfirm && ready && (
          <ConfirmPanel
            selected={[selected[0], selected[1]]}
            onBack={() => setShowConfirm(false)}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </section>
  );
}

function ConfirmPanel({
  selected,
  onBack,
  onConfirm,
}: {
  selected: [SmellMemory, SmellMemory];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const primary = pickPrimary(selected[0], selected[1]);
  const other = primary.id === selected[0].id ? selected[1] : selected[0];
  const stype = getSmellTypeInfo(primary.smell_type);

  return (
    <div className="mt-4 pt-4 border-t border-ochre-300/70 animate-fadeInUp">
      <p className="text-sm text-ink-700/80 mb-3">
        将以更新时间较新的记录为<b className="text-ochre-600">主记录</b>，
        另一条的正文另起一段并入；两条原记录的编号都会保留。合并后列表、筛选、统计与本地存储只按一条计算。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <MergePreviewCard memory={primary} title="主记录（保留全部属性）" highlight />
        <MergePreviewCard memory={other} title="被并入（正文追加，其余舍弃）" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-ink-700/70">
        <span className="font-hand text-base text-ochre-600 mr-1">合并后保留编号</span>
        {Array.from(new Set([primary.id, other.id, ...(primary.merged_from ?? []), ...(other.merged_from ?? [])])).map((id) => (
          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper-50 border border-paper-300 font-mono">
            <Hash className="w-3 h-3" />{id}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 ml-2">
          {stype.emoji} {stype.label} · 地点「{primary.location}」
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onBack} className="btn-secondary !py-2 text-sm">
          <ChevronLeft className="w-4 h-4 mr-1" /> 返回
        </button>
        <button onClick={onConfirm} className="btn-primary !py-2 text-sm">
          <GitMerge className="w-4 h-4 mr-1" /> 确认合并
        </button>
      </div>
    </div>
  );
}

function MergePreviewCard({ memory, title, highlight = false }: { memory: SmellMemory; title: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-ochre-400 bg-paper-50' : 'border-paper-300 bg-paper-100/60'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {highlight
          ? <Crown className="w-3.5 h-3.5 text-ochre-500" />
          : <GitMerge className="w-3.5 h-3.5 text-ink-700/50" />}
        <span className={`text-xs font-medium ${highlight ? 'text-ochre-600' : 'text-ink-700/60'}`}>{title}</span>
      </div>
      <div className="font-serif text-sm font-semibold text-ink-800 truncate">{memory.location}</div>
      <p className="mt-1 text-xs text-ink-700/70 leading-relaxed line-clamp-3 whitespace-pre-wrap">
        {memory.memory_text}
      </p>
    </div>
  );
}
