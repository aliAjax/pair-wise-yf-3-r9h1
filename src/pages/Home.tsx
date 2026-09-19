import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck, Combine, Undo2, X } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
};

const MAX_SELECT = 2;

export default function Home() {
  const { memories, mergeHistory, initIfEmpty, addMemory, updateMemory, deleteMemory, mergeMemories, undoLastMerge } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 勾选瞬间各记录的 updated_at 快照，提交合并时用于检测是否被修改
  const selectionSnapshot = useRef<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

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

  const clearSelection = () => {
    setSelectedIds([]);
    selectionSnapshot.current = {};
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id));
      const next = { ...selectionSnapshot.current };
      delete next[id];
      selectionSnapshot.current = next;
      return;
    }
    if (selectedIds.length >= MAX_SELECT) {
      showNotice(`最多勾选 ${MAX_SELECT} 条记录进行合并`);
      return;
    }
    const target = memories.find((m) => m.id === id);
    if (!target) return;
    selectionSnapshot.current = { ...selectionSnapshot.current, [id]: target.updated_at };
    setSelectedIds([...selectedIds, id]);
  };

  // 预览两条勾选记录是否满足合并条件（仅用于提示，提交时 store 会再次校验）
  const selectedPair = useMemo(
    () => selectedIds.map((id) => memories.find((m) => m.id === id)),
    [selectedIds, memories],
  );
  const pairMismatch =
    selectedIds.length === MAX_SELECT &&
    selectedPair.every(Boolean) &&
    (selectedPair[0]!.location.trim() !== selectedPair[1]!.location.trim() ||
      selectedPair[0]!.smell_type !== selectedPair[1]!.smell_type);

  const handleMerge = () => {
    if (selectedIds.length !== MAX_SELECT) return;
    const [idA, idB] = selectedIds;
    const a = memories.find((m) => m.id === idA);
    const b = memories.find((m) => m.id === idB);
    const summary = a && b ? `「${a.location}」(#${a.id} + #${b.id})` : '两条勾选记录';
    if (!window.confirm(`确认将 ${summary} 合并为一条记录吗？\n正文将并入更新时间较新的主记录，可随时撤销。`)) {
      return;
    }
    const result = mergeMemories(
      idA,
      idB,
      selectionSnapshot.current[idA] ?? '',
      selectionSnapshot.current[idB] ?? '',
    );
    if (result.ok) {
      clearSelection();
      setExpandedId(result.mergedId);
      showNotice('已合并为一条记录，原两条编号已保留');
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-memory-id="${result.mergedId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      // 提交前任一勾选项被修改或移除：整次取消并说明原因
      window.alert(result.reason);
      clearSelection();
    }
  };

  const handleUndoMerge = () => {
    const result = undoLastMerge();
    if (result.ok) {
      showNotice('已撤销合并，恢复为两条原记录');
    } else {
      window.alert(result.reason);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

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

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <span className="text-xs text-ink-700/50">
              点击卡片展开回忆，勾选两条可合并重复记录
            </span>
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
                    isExpanded={expandedId === m.id}
                    isSelected={selectedIds.includes(m.id)}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onToggleSelect={() => toggleSelect(m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
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

      {(selectedIds.length > 0 || mergeHistory.length > 0 || notice) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)]">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2.5 rounded-2xl bg-ink-800/95 text-paper-50 shadow-paper-hover backdrop-blur border border-ink-700">
            {notice && (
              <span className="text-xs text-ochre-200">{notice}</span>
            )}
            {selectedIds.length > 0 && (
              <>
                <span className="text-xs">
                  已勾选 <b className="text-ochre-200">{selectedIds.length}</b>/{MAX_SELECT} 条
                </span>
                {pairMismatch && (
                  <span className="text-xs text-brick-400">地点或气味类型不一致，无法合并</span>
                )}
                <button
                  onClick={handleMerge}
                  disabled={selectedIds.length !== MAX_SELECT || pairMismatch}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    selectedIds.length === MAX_SELECT && !pairMismatch
                      ? 'bg-ochre-500 hover:bg-ochre-400 text-paper-50'
                      : 'bg-ink-700/60 text-paper-50/40 cursor-not-allowed'
                  }`}
                >
                  <Combine className="w-3.5 h-3.5" /> 合并
                </button>
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-paper-50/70 hover:bg-ink-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> 取消勾选
                </button>
              </>
            )}
            {mergeHistory.length > 0 && (
              <button
                onClick={handleUndoMerge}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-moss-500 hover:bg-moss-400 text-paper-50 transition-all duration-200"
                title="撤销最近一次合并，恢复两条原记录"
              >
                <Undo2 className="w-3.5 h-3.5" /> 撤销合并
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
