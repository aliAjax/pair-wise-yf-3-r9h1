import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId } from '../utils/helpers';
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

/** 一次合并的快照，用于撤销 */
export interface MergeRecord {
  mergedId: string;
  /** 合并完成时合并记录的完整快照，用于检测合并后是否被再次编辑 */
  mergedSnapshot: SmellMemory;
  mergedAt: string;
  originals: { memory: SmellMemory; index: number }[];
}

export interface MergeResult {
  ok: boolean;
  mergedId?: string;
  reason?: string;
}
export interface UndoResult {
  ok: boolean;
  reason?: string;
}

interface MemoryStore {
  memories: SmellMemory[];
  mergeHistory: MergeRecord[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  /**
   * 合并两条记录。expectedA/expectedB 为勾选时记录的 updated_at，
   * 提交前任一勾选项被修改或移除则整次取消。
   */
  mergeMemories: (idA: string, idB: string, expectedA: string, expectedB: string) => MergeResult;
  undoLastMerge: () => UndoResult;
  initIfEmpty: () => void;
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      mergeHistory: [],
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
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
        });
      },
      deleteMemory: (id) => {
        set({ memories: get().memories.filter((m) => m.id !== id) });
      },
      mergeMemories: (idA, idB, expectedA, expectedB) => {
        const { memories, mergeHistory } = get();
        const a = memories.find((m) => m.id === idA);
        const b = memories.find((m) => m.id === idB);
        if (!a || !b) {
          return { ok: false, reason: '勾选的记录已被移除，本次合并已整次取消' };
        }
        if (a.updated_at !== expectedA || b.updated_at !== expectedB) {
          return { ok: false, reason: '勾选的记录在提交前已被修改，本次合并已整次取消' };
        }
        if (a.location.trim() !== b.location.trim() || a.smell_type !== b.smell_type) {
          return { ok: false, reason: '只有地点和气味类型都一致的两条记录才能合并' };
        }

        // 主记录取更新时间较新的
        const [primary, secondary] = a.updated_at >= b.updated_at ? [a, b] : [b, a];
        const primaryIdx = memories.findIndex((m) => m.id === primary.id);
        const secondaryIdx = memories.findIndex((m) => m.id === secondary.id);

        const now = new Date().toISOString();
        const mergedText = secondary.memory_text.trim()
          ? `${primary.memory_text}\n\n—— 并入自编号 ${secondary.id} ——\n${secondary.memory_text}`
          : primary.memory_text;
        const merged: SmellMemory = {
          ...primary,
          memory_text: mergedText,
          merged_from: [...(primary.merged_from ?? [primary.id]), secondary.id],
          updated_at: now,
        };

        // 合并后只保留一条，位置沿用主记录所在位置
        const next = memories.filter((m) => m.id !== primary.id && m.id !== secondary.id);
        const insertAt = primaryIdx > secondaryIdx ? primaryIdx - 1 : primaryIdx;
        next.splice(insertAt, 0, merged);

        const record: MergeRecord = {
          mergedId: merged.id,
          mergedSnapshot: merged,
          mergedAt: now,
          originals: [
            { memory: primary, index: primaryIdx },
            { memory: secondary, index: secondaryIdx },
          ],
        };
        set({ memories: next, mergeHistory: [...mergeHistory, record] });
        return { ok: true, mergedId: merged.id };
      },
      undoLastMerge: () => {
        const { memories, mergeHistory } = get();
        const last = mergeHistory[mergeHistory.length - 1];
        if (!last) {
          return { ok: false, reason: '没有可撤销的合并' };
        }
        const merged = memories.find((m) => m.id === last.mergedId);
        if (!merged) {
          set({ mergeHistory: mergeHistory.slice(0, -1) });
          return { ok: false, reason: '合并后的记录已被删除，无法恢复原记录' };
        }
        if (JSON.stringify(merged) !== JSON.stringify(last.mergedSnapshot)) {
          set({ mergeHistory: mergeHistory.slice(0, -1) });
          return { ok: false, reason: '合并结果已被再次编辑，无法恢复原记录' };
        }
        // 移除合并记录，按原位置恢复两条原记录
        const next = memories.filter((m) => m.id !== last.mergedId);
        const sorted = [...last.originals].sort((x, y) => x.index - y.index);
        for (const { memory, index } of sorted) {
          next.splice(Math.min(index, next.length), 0, memory);
        }
        set({ memories: next, mergeHistory: mergeHistory.slice(0, -1) });
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
    },
  ),
);
