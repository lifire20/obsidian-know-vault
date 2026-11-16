---
tags:
  - 集群
  - 集群/Hadoop
  - 集群/Hbase
  - ubuntu
---

# 一、Hadoop

### 集群开启命令
依次执行
```
start-dfs.sh
```

```
start-yarn.sh
```

```
mapred --daemon start historyserver
```

### 集群关闭命令
依次执行
```
stop-yarn.sh
```

```
stop-dfs.sh
```

```
mr-jobhistory-daemon.sh stop historyserver
```
### 完整启动顺序
完整的启动顺序总结
以后每次启动集群，按这个顺序：


```
 1. 启动 ZooKeeper（三台机器）
zkServer.sh start                    # Master
ssh lv@Slave1 "zkServer.sh start"    # Slave1
ssh lv@Slave2 "zkServer.sh start"    # Slave2
2. 启动 Hadoop（Master）
start-dfs.sh
start-yarn.sh
3. 启动 HBase（Master）
start-hbase.sh
```

### 停止顺序
```
# 1. 停止 HBase
stop-hbase.sh

# 2. 停止 Hadoop
stop-yarn.sh
stop-dfs.sh

# 3. 停止 ZooKeeper
zkServer.sh stop                     # Master
ssh lv@Slave1 "zkServer.sh stop"     # Slave1
ssh lv@Slave2 "zkServer.sh stop"     # Slave2
```

### 查看zookeeper集群状态
```
echo "=== Master ==="
zkServer.sh status
echo ""
echo "=== Slave1 ==="
ssh lv@Slave1 "/usr/local/zookeeper/bin/zkServer.sh status"
echo ""
echo "=== Slave2 ==="
ssh lv@Slave2 "/usr/local/zookeeper/bin/zkServer.sh status"
```


# ========== 关闭顺序（逆序） ==========
# 1. 关闭 HBase
```

/usr/local/hbase-2.2.2/bin/stop-hbase.sh
```


1. 关闭 YARN
```

/usr/local/hadoop-3.3.5/sbin/stop-yarn.sh
```

 3. 关闭 HDFS
```
/usr/local/hadoop-3.3.5/sbin/stop-dfs.sh
```

1. 关闭 ZooKeeper（每个节点）
```
ssh master "/usr/local/zookeeper/bin/zkServer.sh stop"
```
```
ssh slave 1 "/usr/local/zookeeper/bin/zkServer.sh stop"
```
```
ssh slave 2 "/usr/local/zookeeper/bin/zkServer.sh stop"
```


# ========== 启动顺序（正序） ==========
1. 启动 ZooKeeper（每个节点）
```
ssh master "/usr/local/zookeeper/bin/zkServer.sh start"
```
```
ssh slave 1 "/usr/local/zookeeper/bin/zkServer.sh start"
```
```
ssh slave 2 "/usr/local/zookeeper/bin/zkServer.sh start"
```
 2. 启动 HDFS
```
/usr/local/hadoop-3.3.5/sbin/start-dfs.sh
```
3. 启动 YARN
```
/usr/local/hadoop-3.3.5/sbin/start-yarn.sh
```

4. 启动 HBase
```
/usr/local/hbase-2.2.2/bin/start-hbase.sh
```
