---
tags:
  - 集群/Hadoop
---
# 查看模式
```
set mapreduce.framework.name;
```

## 临时切换回 YARN
```bash
set mapreduce.framework.name=yarn;
```


## 永久修复 Hive 使用 YARN

如果你希望以后 Hive 默认就用 YARN，编辑 `$HIVE_HOME/conf/hive-site.xml` 或 `mapred-site.xml`（通常 Hadoop 的配置对 Hive 生效）。  
检查 `/usr/local/hadoop/etc/hadoop/mapred-site.xml`，确保：

xml

<property>
  <name>mapreduce.framework.name</name>
  <value>yarn</value>
</property>

然后重启 YARN 服务：

bash

stop-yarn.sh
start-yarn.sh