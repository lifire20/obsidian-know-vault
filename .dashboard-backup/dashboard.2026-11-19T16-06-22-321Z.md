---
dashboard: true
layout: stacked
banner:
  quote: "The mind is everything. What you think you become."
  author: "Buddha"
  image: "https://images.unsplash.com/photo-1788651946293-893d6b217f34?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0"
  quoteFont: "Didot,\"Bodoni MT\",Georgia,serif"
  images:
    - "https://images.unsplash.com/photo-1788651946293-893d6b217f34?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0"
immersiveBackground: "https://images.unsplash.com/photo-1788651946293-893d6b217f34?q=80&w=1374&auto=format&fit=crop&ixlib=rb-4.1.0"
immersive:
  - id: "widget:quickActions"
    w: 3
    cap: 18
    fixed: true
    x: 9
    y: 10
  - id: "widget:weather"
    w: 3
    cap: 19
    fixed: true
    x: 0
    y: 17
  - id: "widget:calendar"
    w: 3
    cap: 33
    fixed: true
    x: 0
    y: 36
  - id: "widget:habit"
    w: 2
    cap: 19
    fixed: true
    x: 10
    y: 58
  - id: "widget:pomodoro"
    w: 2
    cap: 14
    fixed: true
    x: 10
    y: 28
  - id: "widget:expense"
    w: 2
    cap: 16
    fixed: true
    x: 10
    y: 42
  - id: "widget:countdown-cd-2026-end"
    w: 3
    cap: 10
    fixed: true
    x: 9
    y: 0
  - id: "widget:music"
    w: 3
    cap: 17
    fixed: true
    x: 0
    y: 0
  - id: "card:demo-memo-1"
    w: 3
    cap: 21
    fixed: true
    x: 3
    y: 0
  - id: "card:demo-memo-path"
    w: 4
    cap: 21
    fixed: true
    x: 6
    y: 32
  - id: "card:demo-todo-1"
    w: 3
    cap: 32
    fixed: true
    x: 6
    y: 0
  - id: "card:demo-todo-2"
    w: 3
    cap: 32
    fixed: true
    x: 3
    y: 21
  - id: "section:Library"
    w: 7
    cap: 28
    fixed: true
    x: 3
    y: 53
columns:
  - name: 便利贴
    color: "#f59e0b"
    type: sticky
  - name: Library
    color: "#8b5cf6"
    type: projects
    showCover: false
    library:
      viewMode: grid
      sortBy: "modified"
      sortDesc: true
---

## 便利贴

### 2026-11-19 备忘
id: demo-memo-1
type: generic
欢迎使用 Apex Dashboard！点击此处编辑你的第一条备忘。

### 小贴士
id: demo-memo-path
type: generic
- 顶部中央的输入框可以直接记录闪念，回车即保存
- 拖动瓷贴自由摆放，靠近边缘会自动吸附对齐
- 右键瓷贴可移除或一键整理布局，拖动右下角可调整大小
- 左上角 + 按钮可添加备忘、待办、分区与小组件

### 快速上手
id: demo-todo-1
type: task
- [ ] 在顶部输入框记一条闪念
- [ ] 拖动这张卡片换个位置
- [ ] 拖住卡片右下角把它变大
- [ ] 打开左上角 + 添加一个小组件
- [x] 装修ob [due:: 2026-11-20]

### 界面操作指南
id: demo-todo-2
type: task
- [ ] 右键任意瓷贴：移除、整理布局
- [ ] 点击时钟旁的编辑按钮更换海报背景
- [ ] 从左上角工作台名切换或新建工作台
- [ ] 在设置中开启天气、记账、音乐等更多小组件

### 2026-11-19 备忘录
id: card-mwn5o05i
type: task
- [ ] 今天完成

## Library

### Reading
id: demo-lib-reading
type: project

### To Read
id: demo-lib-toread
type: project

### Done
id: demo-lib-done
type: project
