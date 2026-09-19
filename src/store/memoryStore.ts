import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId, canMergeMemories, pickPrimary, mergeMemoryText, verifySnapshots } from '../utils/helpers';
import type { MemorySnapshot } from '../utils/helpers';
import { mockMemories } from '../data/mockData';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

/** 一次合并的撤销快照：保存合并结果与两条原记录 */
export interface MergeUndoEntry {
  /** 合并后主记录的编号 */
  mergedId: string;
  /** 合并结果（用于检测“合并结果已再次编辑”） */
  merged: SmellMemory;
  /** 两条原记录（主记录在前） */
  originals: [SmellMemory, SmellMemory];
  /** 主记录在合并前列表中的位置 */
  primaryIndex: number;
  /** 另一条记录在合并前列表中的位置 */
  otherIndex: number;
  /** 合并结果在合并后是否又被编辑过；为 true 时拒绝恢复 */
  edited: boolean;
  merged_at: string;
}

export interface MergeResult {
  ok: boolean;
  /** 失败原因（ok 为 false 时给出） */
  reason?: string;
}

interface MemoryStore {
  memories: SmellMemory[];
  mergeUndo: MergeUndoEntry | null;
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  mergeMemories: (snapshots: [MemorySnapshot, MemorySnapshot]) => MergeResult;
  undoMerge: () => { ok: boolean; reason?: string };
  initIfEmpty: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      mergeUndo: null,
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input) => {
        const undo = get().mergeUndo;
        // 编辑合并结果后，撤销快照失效：拒绝再恢复两条原记录
        const nextUndo = undo && undo.mergedId === id && !undo.edited
          ? { ...undo, edited: true }
          : undo;
        set({
          mergeUndo: nextUndo,
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
      },
      deleteMemory: (id) => {
        const undo = get().mergeUndo;
        set({
          // 删除合并结果后，撤销入口一并作废（原记录不再恢复）
          mergeUndo: undo && undo.mergedId === id ? null : undo,
          memories: get().memories.filter((m) => m.id !== id),
        });
      },
      mergeMemories: (snapshots) => {
        const memories = get().memories;

        // 提交前校验：任一枚选项被修改或移除，整次取消并说明原因
        const invalid = verifySnapshots(snapshots, memories);
        if (invalid) return { ok: false, reason: invalid };

        const [s1, s2] = snapshots;
        const a = memories.find((m) => m.id === s1.id);
        const b = memories.find((m) => m.id === s2.id);
        if (!a || !b) {
          return { ok: false, reason: '勾选记录不存在，本次合并已取消。' };
        }
        if (a.id === b.id) {
          return { ok: false, reason: '不能将同一条记录与自身合并。' };
        }
        if (!canMergeMemories(a, b)) {
          return { ok: false, reason: '只有地点和气味类型一致的两条记录才能合并。' };
        }

        const primary = pickPrimary(a, b);
        const other = primary.id === a.id ? b : a;
        const primaryIndex = memories.findIndex((m) => m.id === primary.id);
        const otherIndex = memories.findIndex((m) => m.id === other.id);

        // 保留两条原记录编号（含它们各自已有的合并来源编号）
        const mergedFrom = Array.from(new Set([
          primary.id,
          other.id,
          ...(primary.merged_from ?? []),
          ...(other.merged_from ?? []),
        ]));
        const mergedAt = new Date().toISOString();

        const merged: SmellMemory = {
          ...primary,
          memory_text: mergeMemoryText(primary.memory_text, other.memory_text),
          merged_from: mergedFrom,
          merged_at: mergedAt,
          // 合并本身是一次修改：更新时间取本次合并时刻，
          // 因此合并记录再次参与合并时天然为主记录
          updated_at: mergedAt,
        };

        const originals: [SmellMemory, SmellMemory] = [primary, other];
        const nextMemories = memories
          .filter((m) => m.id !== other.id)
          .map((m) => (m.id === primary.id ? merged : m));

        set({
          memories: nextMemories,
          mergeUndo: {
            mergedId: merged.id,
            merged,
            originals,
            primaryIndex,
            otherIndex,
            edited: false,
            merged_at: mergedAt,
          },
        });
        return { ok: true };
      },
      undoMerge: () => {
        const undo = get().mergeUndo;
        if (!undo) {
          return { ok: false, reason: '没有可撤销的合并。' };
        }
        if (undo.edited) {
          return { ok: false, reason: '合并结果已被再次编辑，无法恢复为两条原记录。' };
        }
        const memories = get().memories;
        const currentIndex = memories.findIndex((m) => m.id === undo.mergedId);
        if (currentIndex === -1) {
          // 合并结果已被删除时，撤销入口理应已作废；此处兜底
          set({ mergeUndo: null });
          return { ok: false, reason: '合并结果已被删除，无法恢复。' };
        }

        const [primary, other] = undo.originals;
        const next = [...memories];
        next.splice(currentIndex, 1, primary);
        // 按合并前的相对位置放回另一条原记录
        if (undo.otherIndex > undo.primaryIndex) {
          next.splice(currentIndex + 1, 0, other);
        } else {
          next.splice(currentIndex, 0, other);
        }
        set({ memories: next, mergeUndo: null });
        return { ok: true };
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
      // mergeUndo 与 memories 一并持久化：刷新后合并仍按一条计算、仍可撤销
    },
  ),
);
