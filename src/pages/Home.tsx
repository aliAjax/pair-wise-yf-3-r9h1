import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import MergeBar from '../components/MergeBar';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters, MemorySnapshot } from '../utils/helpers';
import { filterMemories } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck, GitMerge, Undo2, X, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
};

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** 成功合并时附带撤销动作 */
  undoAction?: () => void;
}

export default function Home() {
  const {
    memories,
    mergeUndo,
    initIfEmpty,
    addMemory,
    updateMemory,
    deleteMemory,
    mergeMemories,
    undoMerge,
  } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  // 合并勾选模式
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const snapshotsRef = useRef<Map<string, MemorySnapshot>>(new Map());
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

  const selectedMemories = useMemo(
    () =>
      selectedIds
        .map((id) => memories.find((m) => m.id === id))
        .filter((m): m is SmellMemory => Boolean(m)),
    [selectedIds, memories],
  );

  // Toast 自动消失（带撤销按钮的不自动消失，等用户操作或新提示覆盖）
  useEffect(() => {
    if (!toast || toast.undoAction) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // 勾选期间的完整性守卫：任一勾选项被修改或移除，整次取消并说明原因
  useEffect(() => {
    if (!mergeMode) return;
    for (const snap of snapshotsRef.current.values()) {
      const now = memories.find((m) => m.id === snap.id);
      if (!now) {
        abortMerge(`原勾选记录（编号 ${snap.id}）已被移除，本次合并已取消，请重新勾选。`);
        return;
      }
      if (now.updated_at !== snap.updated_at) {
        abortMerge(`原勾选记录（编号 ${snap.id}）在勾选后被修改过，本次合并已取消，请重新勾选。`);
        return;
      }
      if (now.location !== snap.location || now.smell_type !== snap.smell_type) {
        abortMerge(`原勾选记录（编号 ${snap.id}）的地点或气味类型已变化，本次合并已取消，请重新勾选。`);
        return;
      }
    }
    // 仅依赖 memories：勾选动作本身不改 memories，不会误触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, mergeMode]);

  const showToast = (kind: ToastKind, message: string, undoAction?: () => void) => {
    setToast({ id: Date.now() + Math.random(), kind, message, undoAction });
  };

  const enterMergeMode = () => {
    setMergeMode(true);
    setSelectedIds([]);
    snapshotsRef.current = new Map();
    setExpandedId(null);
  };

  const abortMerge = (reason: string, silent = false) => {
    setMergeMode(false);
    setSelectedIds([]);
    snapshotsRef.current = new Map();
    if (!silent) showToast('error', reason);
  };

  const toggleSelect = (m: SmellMemory) => {
    setSelectedIds((prev) => {
      let next: string[];
      if (prev.includes(m.id)) {
        next = prev.filter((id) => id !== m.id);
        snapshotsRef.current.delete(m.id);
      } else {
        if (prev.length >= 2) return prev; // 最多勾选两条
        next = [...prev, m.id];
        snapshotsRef.current.set(m.id, {
          id: m.id,
          updated_at: m.updated_at,
          location: m.location,
          smell_type: m.smell_type,
        });
      }
      return next;
    });
  };

  const handleCommit = (snapshots: [MemorySnapshot, MemorySnapshot]) => {
    const result = mergeMemories(snapshots);
    if (!result.ok) {
      // 校验失败（含提交前被修改/移除）：整次取消并说明原因
      setMergeMode(false);
      setSelectedIds([]);
      snapshotsRef.current = new Map();
      showToast('error', result.reason ?? '合并失败，本次操作已取消。');
      return result;
    }
    const [s1, s2] = snapshots;
    setMergeMode(false);
    setSelectedIds([]);
    snapshotsRef.current = new Map();
    showToast(
      'success',
      `已将编号 ${s1.id}、${s2.id} 的两条记录合并为一条，列表、筛选、统计与本地存储均按一条计算。`,
      () => handleUndoMerge(),
    );
    return result;
  };

  const handleUndoMerge = () => {
    const undo = useMemoryStore.getState().mergeUndo;
    if (undo?.edited) {
      showToast('error', '合并结果已被再次编辑，无法恢复为两条原记录。');
      return;
    }
    const result = undoMerge();
    if (result.ok) {
      showToast('info', '已撤销合并，两条原记录均已恢复，编号保持不变。');
    } else {
      showToast('error', result.reason ?? '撤销失败。');
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput) => {
    if (editing) {
      updateMemory(editing.id, data);
    } else {
      addMemory(data);
    }
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const undoDisabled = Boolean(mergeUndo?.edited);

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={memories.length} />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <VisualizationPanel memories={filteredMemories} onSelect={scrollToCard} />

        {mergeMode ? (
          <MergeBar
            selected={selectedMemories}
            onCancel={() => abortMerge('已取消合并，勾选已清空。', true)}
            onCommit={handleCommit}
          />
        ) : null}

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <div className="flex items-center gap-2">
              {mergeUndo && !mergeMode && (
                <button
                  onClick={handleUndoMerge}
                  disabled={undoDisabled}
                  title={undoDisabled ? '合并结果已被再次编辑，不能恢复' : '恢复合并前的两条原记录'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    undoDisabled
                      ? 'bg-paper-200/60 text-ink-700/40 border-paper-300 cursor-not-allowed'
                      : 'bg-lavender-300/30 text-lavender-600 border-lavender-300/60 hover:bg-lavender-300/50'
                  }`}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  撤销合并
                  {undoDisabled && <Ban className="w-3 h-3" />}
                </button>
              )}
              {!mergeMode && (
                <button
                  onClick={enterMergeMode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-ochre-300 bg-ochre-100/70 text-ochre-600 hover:bg-ochre-100 transition-all duration-200"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  合并重复记录
                </button>
              )}
              <span className="text-xs text-ink-700/50 hidden sm:inline">
                {mergeMode ? '点击卡片勾选两条（最多两条）' : '点击卡片展开完整回忆'}
              </span>
            </div>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {(filters.smellType || filters.season || filters.emotion) && (
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredMemories.map((m, idx) => (
                <div key={m.id} data-memory-id={m.id}>
                  <MemoryCard
                    memory={m}
                    index={idx}
                    isExpanded={!mergeMode && expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    selectMode={mergeMode}
                    selected={selectedIds.includes(m.id)}
                    onToggleSelect={() => toggleSelect(m)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>愿每一缕气味，都是打开旧时光的钥匙 · Scent Archive</p>
      </footer>

      <MemoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editingData={editing}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-xl animate-fadeInUp">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.kind === 'success'
                ? 'bg-moss-100/95 border-moss-200 text-moss-600'
                : toast.kind === 'error'
                  ? 'bg-brick-400/15 border-brick-400/40 text-brick-600'
                  : 'bg-paper-50/95 border-paper-300 text-ink-800'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {toast.kind === 'success'
                ? <CheckCircle2 className="w-5 h-5" />
                : toast.kind === 'error'
                  ? <AlertTriangle className="w-5 h-5" />
                  : <Undo2 className="w-5 h-5 text-ochre-500" />}
            </span>
            <p className="flex-1 text-sm leading-relaxed text-ink-800/90">{toast.message}</p>
            {toast.undoAction && (
              <button
                onClick={() => { toast.undoAction?.(); }}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-ochre-500 hover:bg-ochre-600 text-paper-50 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> 撤销合并
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="shrink-0 p-1 rounded-lg text-ink-700/50 hover:text-ink-800 hover:bg-paper-200/70 transition-colors"
              aria-label="关闭提示"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
