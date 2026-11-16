---
tags:
  - sqoop
  - 集群
---

太好了，`hive` 启动成功并且 `show databases;` 正常输出，说明 Hive 已经完全就绪。

---

## 下一步：安装 Sqoop 1.4.7

根据实验要求，你需要安装 Sqoop 用于将 MySQL 中的数据导入到 HBase。Sqoop 只需安装在 master 节点。



### 1. 下载 Sqoop 1.4.7

如果 Windows 本地已有安装包，可以像之前一样用 `scp` 上传到 `~/bigdata`。
```bash
scp sqoop-1.4.7.bin__hadoop-2.6.0.tar.gz lvruitong@192.168.125.101:/home/lvruitong/bigdata/
```
如果没有，可以在 master 终端用 `wget` 下载（较慢，但能成功）：

```bash
cd ~/bigdata
wget https://archive.apache.org/dist/sqoop/1.4.7/sqoop-1.4.7.bin__hadoop-2.6.0.tar.gz
```

> 注意：文件名中的 `hadoop-2.6.0` 并不影响与 Hadoop 3.x 的兼容，Sqoop 1.4.7 可以与 Hadoop 3.x 正常工作。

### 2. 解压并安装到 `/usr/local`

```bash
sudo tar -zxvf sqoop-1.4.7.bin__hadoop-2.6.0.tar.gz -C /usr/local/
cd /usr/local
sudo mv sqoop-1.4.7.bin__hadoop-2.6.0 sqoop-1.4.7
sudo chown -R lvruitong:lvruitong sqoop-1.4.7
```

### 3. 配置环境变量

```bash
nano ~/.bashrc
```

在末尾添加：

```bash
export SQOOP_HOME=/usr/local/sqoop-1.4.7
export PATH=$PATH:$SQOOP_HOME/bin
```

保存后执行 `source ~/.bashrc`。

### 4. 配置 Sqoop 环境

复制配置文件模板：

```bash
cd $SQOOP_HOME/conf
cp sqoop-env-template.sh sqoop-env.sh
nano sqoop-env.sh
```

在文件末尾或适当位置添加以下内容（设置 Hadoop、HBase、Hive 的路径）：

```bash
export HADOOP_COMMON_HOME=/usr/local/hadoop-3.3.5
export HADOOP_MAPRED_HOME=/usr/local/hadoop-3.3.5
export HBASE_HOME=/usr/local/hbase-2.2.2
export HIVE_HOME=/usr/local/hive
export ZOOCFGDIR=/usr/local/zookeeper-3.7.0/conf
```

### 5. 下载 MySQL JDBC 驱动（供 Sqoop 使用）

Sqoop 连接 MySQL 也需要 JDBC 驱动，可以直接使用刚才 Hive 下载的那个：

```bash
cp /home/lvruitong/bigdata/mysql-connector-java-8.0.30.jar $SQOOP_HOME/lib/
```

### 6. 验证 Sqoop 安装

```bash
sqoop version
```

应该显示 Sqoop 1.4.7 的版本信息。

---

## 下一步计划

完成 Sqoop 安装后，整个大数据平台（Hadoop, Zookeeper, HBase, Hive, MySQL, Sqoop）就全部就绪了。  
接下来你需要：

1. **选择一个课题**（例如电信客户流失数据分析、淘宝广告点击量等），并获取对应的 CSV 数据文件。
2. **按照实验报告要求**：
   - 在 MySQL 中创建原始数据表
   - 将 CSV 数据导入 MySQL
   - 使用 Sqoop 将数据从 MySQL 导入 HBase
   - 在 Hive 中对数据进行分析（编写 SQL）
   - 将分析结果存回 MySQL
   - （选做）可视化分析

你可以先安装 Sqoop，然后我们根据你选择的课题，一步步进行数据导入和分析。有任何问题随时问。