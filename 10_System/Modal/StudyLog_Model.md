---
type: study-log
date: <% tp.date.now("YYYY-MM-DD") %> 
tags:
  - 学习日志
system: "true"
records:
  - subject: 
    category: 
    topic: 
    duration: 
    status: 
  - subject: 
    category: 
    topic: 
    duration: 
    status: 
---

# 今日学习时长统计

```dataviewjs
const records = dv.current().records;

let grouped = {};

for (let r of records) {
    if (!grouped[r.subject]) {
        grouped[r.subject] = 0;
    }

    grouped[r.subject] += r.duration;
}

const labels = Object.keys(grouped);
const values = Object.values(grouped);

dv.paragraph(`
\`\`\`chart
type: pie
labelColors: true

labels:
${labels.map(l => `  - ${l}`).join("\n")}

series:
  - title: 学习时间
    data:
${values.map(v => `      - ${v}`).join("\n")}
\`\`\`
`);
```

```dataview
TABLE 
  record.subject AS subject,
  record.topic AS topic,
  record.duration AS duration,
  record.status AS status
FROM "00_Shared/StudyLog"
WHERE file.name = this.file.name
FLATTEN records AS record
SORT file.time DESC
```
