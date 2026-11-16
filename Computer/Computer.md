

# 学习内容

--- start-multi-column: my-three-columns
```column-settings
Number of Columns: 3
```

- Java
	[[Java]]
	

--- end-column ---

- 算法
	- [[算法]]

--- end-column ---

- 阅读
	- [阅读仪表盘](obsidian://adv-uri?vault=oc&filepath=%E4%BB%AA%E8%A1%A8%E7%9B%98%2F%E9%98%85%E8%AF%BB%E4%BB%AA%E8%A1%A8%E7%9B%98.md)

--- end-multi-column

---


--- start-multi-column: my-two-columns

# 最新编辑

```dataview
LIST
FROM ""
SORT file.mtime DESC
LIMIT 3
```

--- end-column ---

# 学习状态一览
[[Statistics]]

--- end-multi-column










# 时长统计

```dataviewjs
const TARGET_CATEGORY = "计算机";

// 获取所有学习日志
const pages = dv.pages('"Diary/StudyLog"');

// subject统计
let grouped = {};

// 遍历所有页面
for (let page of pages) {

    if (!page.records) continue;

    // 遍历 records
    for (let r of page.records) {

        // 只统计目标 category
        if (r.category !== TARGET_CATEGORY) continue;

        // 跳过空值
        if (!r.subject || !r.duration) continue;

        // 初始化
        if (!grouped[r.subject]) {
            grouped[r.subject] = 0;
        }

        // 累加时间
        grouped[r.subject] += Number(r.duration);
    }
}

// 按学习时间排序（从高到低）
grouped = Object.fromEntries(
    Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
);

// labels 和 values
const labels = Object.keys(grouped);
const values = Object.values(grouped);

// 输出图表
dv.paragraph(`
\`\`\`chart
type: bar
labelColors: true

labels:
${labels.map(l => `  - ${l}`).join("\n")}

series:
  - title: ${TARGET_CATEGORY} 学科学习总时长
    data:
${values.map(v => `      - ${v}`).join("\n")}


yAxisLabel: 分钟
\`\`\`
`);
```

```dataviewjs
const TARGET_CATEGORY = "计算机";

// 获取所有学习日志
const pages = dv.pages('"Diary/StudyLog"');

// subject统计
let grouped = {};

// 遍历所有页面
for (let page of pages) {

    if (!page.records) continue;

    // 遍历 records
    for (let r of page.records) {

        // 只统计目标 category
        if (r.category !== TARGET_CATEGORY) continue;

        // 跳过空值
        if (!r.subject || !r.duration) continue;

        // 初始化
        if (!grouped[r.subject]) {
            grouped[r.subject] = 0;
        }

        // 累加时间
        grouped[r.subject] += Number(r.duration);
    }
}

// 按学习时间排序（从高到低）
grouped = Object.fromEntries(
    Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
);

// labels 和 values
const labels = Object.keys(grouped);
const values = Object.values(grouped);

// 输出图表
dv.paragraph(`
\`\`\`chart
type: doughnut
labelColors: true

labels:
${labels.map(l => `  - ${l}`).join("\n")}

series:
  - title: ${TARGET_CATEGORY} 学科学习总时长
    data:
${values.map(v => `      - ${v}`).join("\n")}


yAxisLabel: 分钟
\`\`\`
`);
```
