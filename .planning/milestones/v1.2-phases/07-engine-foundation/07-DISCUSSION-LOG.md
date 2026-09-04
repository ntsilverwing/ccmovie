# Phase 7: Engine Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 7-Engine Foundation
**Areas discussed:** 定位边界, 字幕空档, 暂停时定位

---

## 定位边界

| Decision | Selected |
|----------|----------|
| Timeline 右端 | 停在最后一句末尾 |
| 越界目标 | 统一夹紧到合法范围 |
| 播放中定位至末尾 | 立即结束并清除会话 |
| 定位到 0:00 | 保持播放并等待第一句 |

**Notes:** 总时长来自最后一条有效字幕的结束时间；不增加片尾空白区。

---

## 字幕空档

| Decision | Selected |
|----------|----------|
| 定位到字幕空档 | 保持黑屏空白 |
| 暂停时位于空档 | 仍保持空白 |
| 重叠字幕 | 保持现有文件顺序 |
| 无有效字幕 | 保持空闲且不创建会话 |

**Notes:** 不吸附到相邻字幕，避免将 Timeline 从精确定位变成近似导航。

---

## 暂停时定位

| Decision | Selected |
|----------|----------|
| Seek 后播放状态 | 保持暂停 |
| 新位置保存时机 | 提交后立即保存 |
| 刷新后的续播 | 从该位置直接播放 |
| Timeline 位置空间 | 校正后的显示时间 |

**Notes:** offset 保持不变，且只能应用一次。

---

## Deferred Ideas

- `playback-toolbar-layout.md` — 保留给 Phase 10 的控制区布局重构。
