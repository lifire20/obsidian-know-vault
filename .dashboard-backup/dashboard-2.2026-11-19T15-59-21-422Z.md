---
dashboard: true
layout: side
banner:
  quote: "The mind is everything. What you think you become."
  author: "Buddha"
  image: "https://images.pexels.com/photos/2307638/pexels-photo-2307638.jpeg"
  quoteFont: "Didot,\"Bodoni MT\",Georgia,serif"
  images:
    - "https://images.pexels.com/photos/2307638/pexels-photo-2307638.jpeg"
    - "https://images.pexels.com/photos/10664504/pexels-photo-10664504.jpeg"
  mode: stats
  statsConfig:
    dailyFolder: "02.生活记录/每日笔记"
    streakFromDaily: false
    excludeFolders:
      - "00.主页"
      - "10_System"
    blur: 11
    showDetails: true
    showLeft: true
    showCenter: true
    showRight: true
    leftStat: totalNotes
    centerStat: streak
    rightStats:
      - taskCompletion
      - connectivity
      - avgLinksPerNote
immersiveBackground: "https://images.pexels.com/photos/2307638/pexels-photo-2307638.jpeg"
columns:
  - name: 便利贴
    color: "#f59e0b"
    type: sticky
  - name: 网页
    color: "#6366f1"
    type: web
    height: 820.6666870117188
    web:
      url: "https://www.xiaolincoding.com/interview/java.html#%E6%A6%82%E5%BF%B5"
  - name: 数据库
    color: "#6366f1"
    type: library
    library:
      viewMode: grid
      sortBy: "modified"
      sortDesc: true
      excludeFolders:
        - "00.主页"
        - "10_System"
        - "assets"
        - "附件"
        - "模板"
        - "img"
        - "07.会议与商业"
        - "05.知识卡片"
        - "99_Resources/copilot"
      viewGroupMode: folder
  - name: deep
    color: "#6366f1"
    type: web
    web:
      url: "https://chat.deepseek.com/"
---

## 便利贴

### 2026-11-19 备忘
id: demo-memo-1
type: generic
不要忘记关梯子

### 快速上手
id: demo-todo-1
type: task
- [ ] 计网实验
- [ ] 集合听完
- [x] 容器实验五

## 网页

## 数据库

## deep
