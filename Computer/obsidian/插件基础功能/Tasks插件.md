---
tags: 
- 插件
- Tasks
---

## 写任务语法
1.手动输入
- [ ] 任务描述 # 标签/标签 🔁 重复规则 ⏳ 计划日期 🛫 开始日期 📅 截止日期 ✅ 完成日期 🔼 优先级

2.命令面板
crtl+P打开命令面板，输入Tasks： Create or edit，填写表单即可

## 查询语法
### 基础查询示例
```tasks
# 只显示未完成的任务
not done

# 截止日期是今天
due today

# 按优先级从高到低排
sort by priority

# 设置分组，让界面更清晰
group by priority
```
### 常用过滤器

|过滤器|作用|示例|
|---|---|---|
|**按状态**|`not done`|仅显示未完成任务|
||`done`|仅显示已完成任务|
|**按日期**|`due today`|截止日期是今天|
||`due after 2024-12-01`|截止日期在某个日期之后|
||`due before in 7 days`|截止日期在未来7天内|
||`happens this week`|包含计划、开始或截止日期在本周|
|**按标签**|`tags include # 工作`|包含指定标签的任务|
|**按文件夹**|`path includes 项目`|路径中包含特定关键词的任务|
|**按优先级**|`priority is high`|仅显示高优先级任务|

### 排序与分组
|指令|作用|说明|
|---|---|---|
|**排序**|`sort by due`|按截止日期排序|
||`sort by priority`|按优先级排序|
||`sort by status`|按状态（未完成/完成）排序|
|**分组**|`group by folder`|按所在笔记的文件夹分组|
||`group by heading`|按任务所在笔记的标题分组|
||`group by priority`|按优先级分组|
|**限制**|`limit 10`|限制查询结果最多显示10个任务|