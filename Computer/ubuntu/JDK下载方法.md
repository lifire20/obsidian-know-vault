---
tags: JDK
---

1.输入命令
```
sudo apt update
```
更新包列表
2.输入命令
```
sudo apt install openjdk-11-jdk -y
```
进行安装
3.输入命令
```
update-java-alternatives --list
```
查看已安装的jdk
输出类似于:
```
lv@Slave1:~$ update-java-alternatives --list
java-1.11.0-openjdk-amd64      1111       /usr/lib/jvm/java-1.11.0-openjdk-amd64
java-1.8.0-openjdk-amd64       1081       /usr/lib/jvm/java-1.8.0-openjdk-amd64
```
4.输入命令选择要使用的Java版本
```
sudo update-alternatives --config java
sudo update-alternatives --config javac
```
输出类似与：
```
lv@Slave1:~$ sudo update-alternatives --config java
有 2 个候选项可用于替换 java (提供 /usr/bin/java)。

  选择       路径                                          优先级  状态
------------------------------------------------------------
* 0            /usr/lib/jvm/java-11-openjdk-amd64/bin/java      1111      自动模式
  1            /usr/lib/jvm/java-11-openjdk-amd64/bin/java      1111      手动模式
  2            /usr/lib/jvm/java-8-openjdk-amd64/jre/bin/java   1081      手动模式

要维持当前值[*]请按<回车键>，或者键入选择的编号：
lv@Slave1:~$ sudo update-alternatives --config javac
有 2 个候选项可用于替换 javac (提供 /usr/bin/javac)。

  选择       路径                                        优先级  状态
------------------------------------------------------------
* 0            /usr/lib/jvm/java-11-openjdk-amd64/bin/javac   1111      自动模式
  1            /usr/lib/jvm/java-11-openjdk-amd64/bin/javac   1111      手动模式
  2            /usr/lib/jvm/java-8-openjdk-amd64/bin/javac    1081      手动模式

要维持当前值[*]请按<回车键>，或者键入选择的编号：
lv@Slave1:~$
```
星号的位置表示默认选择的版本，自动模式表示系统自动帮你选择优先级高的版本，以后安装了其他级别更高的版本的话系统会选择哪个更高的版本。

5.检查版本
输入`java -version`查看
输出类似于：
```
lv@Slave1:~$ java -version
openjdk version "11.0.30" 2026-01-20
OpenJDK Runtime Environment (build 11.0.30+7-post-Ubuntu-1ubuntu124.04)
OpenJDK 64-Bit Server VM (build 11.0.30+7-post-Ubuntu-1ubuntu124.04, mixed mode, sharing)
```
即为成功
