import type { SmellMemory } from '../utils/constants';
import { getSeasonInfo, getSmellTypeInfo, getEmotionInfo } from '../utils/constants';
import { formatDate, contrastTextColor } from '../utils/helpers';
import { Pencil, Trash2, ChevronDown, ChevronUp, Heart, Check, GitMerge, Hash } from 'lucide-react';

interface Props {
  memory: SmellMemory;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** 合并勾选模式：整卡点击切换勾选，隐藏编辑/删除 */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export default function MemoryCard({
  memory,
  index,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const season = getSeasonInfo(memory.season);
  const stype = getSmellTypeInfo(memory.smell_type);
  const emotion = getEmotionInfo(memory.emotion);

  const intensityWidth = `${memory.intensity * 10}%`;
  const humidityWidth = `${memory.humidity * 10}%`;

  const handleCardClick = () => {
    if (selectMode) onToggleSelect?.();
    else onToggle();
  };

  return (
    <article
      className={`group relative bg-paper-50 rounded-2xl border shadow-card overflow-hidden transition-all duration-300 animate-fadeInUp ${
        selectMode
          ? selected
            ? 'border-ochre-500 ring-2 ring-ochre-400 -translate-y-0.5 shadow-paper-hover cursor-pointer'
            : 'border-ochre-300 hover:border-ochre-400 hover:-translate-y-0.5 cursor-pointer'
          : 'border-paper-300 hover:shadow-paper-hover hover:-translate-y-1'
      }`}
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
      onClick={selectMode ? handleCardClick : undefined}
    >
      <div className="flex">
        <div
          className="w-2 shrink-0 relative overflow-hidden transition-all duration-300 group-hover:w-3"
          style={{ backgroundColor: memory.color_association }}
        >
          <div className="absolute inset-0 opacity-30"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="p-4 pb-3 cursor-pointer select-none"
            onClick={selectMode ? undefined : onToggle}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl font-semibold text-ink-800 leading-tight truncate">
                  {memory.location}
                </h3>
                <p className="text-sm text-ink-700/70 mt-0.5 truncate">
                  <span className="mr-1" style={{ color: stype.color }}>{stype.emoji}</span>
                  {memory.source_guess}
                </p>
              </div>
              {selectMode ? (
                <div
                  className={`w-7 h-7 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                    selected
                      ? 'bg-ochre-500 border-ochre-500 text-paper-50'
                      : 'bg-paper-50 border-paper-400 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4" strokeWidth={3} />
                </div>
              ) : (
                <div
                  className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center shadow-sm border-2 border-paper-50"
                  style={{
                    backgroundColor: memory.color_association,
                    color: contrastTextColor(memory.color_association),
                  }}
                  title={`颜色联想: ${memory.color_association}`}
                >
                  <span className="text-xs font-bold">色</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={`scent-tag ${emotion.bg} ${emotion.text}`}>
                {emotion.emoji} {emotion.label}
              </span>
              <span className="scent-tag bg-ochre-100 text-ochre-600">
                {season.emoji} {season.label}
              </span>
              <span
                className="scent-tag text-paper-50"
                style={{ backgroundColor: stype.color }}
              >
                {stype.label}
              </span>
              {memory.want_again && (
                <span className="scent-tag bg-moss-100 text-moss-600">
                  <Heart className="w-3 h-3 fill-current" /> 想再闻
                </span>
              )}
              {memory.merged_from && memory.merged_from.length > 0 && (
                <span className="scent-tag bg-lavender-300/40 text-lavender-600" title="由重复记录合并而来">
                  <GitMerge className="w-3 h-3" /> 合并 · 原 {memory.merged_from.length} 条
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div>
                <div className="flex items-center justify-between text-[11px] text-ink-700/60 mb-1">
                  <span>强度</span>
                  <span className="font-semibold text-ochre-600">{memory.intensity}/10</span>
                </div>
                <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: intensityWidth,
                      background: 'linear-gradient(90deg, #D4B487 0%, #8B5A2B 60%, #5C3A1D 100%)',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-ink-700/60 mb-1">
                  <span>湿度感</span>
                  <span className="font-semibold text-moss-600">
                    {memory.humidity <= 3 ? '偏干' : memory.humidity <= 6 ? '适中' : '偏湿'}
                  </span>
                </div>
                <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: humidityWidth,
                      background: 'linear-gradient(90deg, #CFDBD3 0%, #7DA08C 60%, #3D5A4A 100%)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-paper-200/80">
              <span className="text-[11px] text-ink-700/50">{formatDate(memory.created_at)}</span>
              {selectMode ? (
                <span className="text-[11px] font-medium text-ochre-600">
                  {selected ? '取消勾选' : '点击勾选'}
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(); }}
                  className="inline-flex items-center gap-1 text-[11px] text-ochre-600 hover:text-ochre-700 font-medium"
                >
                  {isExpanded ? (
                    <><ChevronUp className="w-3.5 h-3.5" /> 收起</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> 展开回忆</>
                  )}
                </button>
              )}
            </div>
          </div>

          {isExpanded && !selectMode && (
            <div className="px-4 pb-4 animate-expand overflow-hidden">
              <div className="p-4 rounded-xl bg-paper-100/70 border border-paper-200/80">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-hand text-lg text-ochre-600">关联记忆</span>
                </div>
                <p className="font-serif text-[15px] leading-relaxed text-ink-800 whitespace-pre-wrap">
                  {memory.memory_text}
                </p>
              </div>
              {memory.merged_from && memory.merged_from.length > 0 && (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-lavender-300/20 border border-lavender-300/50">
                  <div className="flex items-center gap-1.5 text-[11px] text-lavender-600 font-medium mb-1">
                    <GitMerge className="w-3.5 h-3.5" /> 本条由重复记录合并而来，保留的原记录编号
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {memory.merged_from.map((fid) => (
                      <span key={fid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-paper-50 border border-paper-300 text-[10px] font-mono text-ink-700/70">
                        <Hash className="w-2.5 h-2.5" />{fid}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-paper-200/60">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-700/50">
                  <span>更新于 {formatDate(memory.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ochre-600 hover:bg-ochre-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> 编辑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-brick-500 hover:bg-brick-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isExpanded && !selectMode && (
            <div className="px-4 pb-3 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ochre-600 hover:bg-ochre-100 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-brick-500 hover:bg-brick-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
