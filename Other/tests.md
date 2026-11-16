```dataviewjs
const TARGET_SUBJECT = "obsidian";

// 获取所有学习日志
const pages = dv.pages('"Diary/StudyLog"');

// topic统计
let grouped = {};

// 遍历所有文件
for (let page of pages) {

    if (!page.records) continue;

    for (let r of page.records) {

        // 只统计目标学科
        if (r.subject !== TARGET_SUBJECT) continue;

        if (!r.topic || !r.duration) continue;

        // 初始化
        if (!grouped[r.topic]) {
            grouped[r.topic] = 0;
        }

        // 累加
        grouped[r.topic] += Number(r.duration);
    }
}

// 输出表格
dv.table(
    ["Topic", "总时长"],
    Object.entries(grouped)
);
```

```dataviewjs
const TARGET_SUBJECT = "四级";

// 获取所有学习日志
const pages = dv.pages('"Diary/StudyLog"');

// topic统计
let grouped = {};

// 遍历所有文件
for (let page of pages) {

    if (!page.records) continue;

    for (let r of page.records) {

        // 只统计目标学科
        if (r.subject !== TARGET_SUBJECT) continue;

        if (!r.topic || !r.duration) continue;

        // 初始化
        if (!grouped[r.topic]) {
            grouped[r.topic] = 0;
        }

        // 累加
        grouped[r.topic] += Number(r.duration);
    }
}

// 输出表格
dv.paragraph(`  
\`\`\`chart  
type: bar  
  
labels:  
${Object.keys(grouped).map(l => ` - ${l}`).join("\n")}  
  
series:  
- title: 四级 Topic 学习时长  
data:  
${Object.values(grouped).map(v => ` - ${v}`).join("\n")}  
  
colors:  
- "#9ece6a"  
\`\`\`  
`);
```


```dataviewjs
const TARGET_SUBJECT = "四级";
const TARGET_TOPIC = "单词";

const pages = dv.pages('"Diary/StudyLog"')
    .sort(p => p.date);

// 日期统计
let grouped = {};

// 遍历
for (let page of pages) {

    if (!page.records) continue;

    let total = 0;

    for (let r of page.records) {

        if (
            r.subject === TARGET_SUBJECT &&
            r.topic === TARGET_TOPIC &&
            r.duration
        ) {
            total += Number(r.duration);
        }
    }

    // 有数据才记录
    if (total > 0) {
        grouped[page.date] = total;
    }
}

// 输出折线图
dv.paragraph(`
\`\`\`chart
type: line

labels:
${Object.keys(grouped).map(d => `  - ${d}`).join("\n")}

series:
  - title: 四级-单词 每日学习时长
    data:
${Object.values(grouped).map(v => `      - ${v}`).join("\n")}

colors:
  - "#7aa2f7"
\`\`\`
`);
```