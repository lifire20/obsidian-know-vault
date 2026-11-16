---
tags:
  - ubuntu
---

修改 IP：

bash

```bash
sudo nano /etc/netplan/00-installer-config.yaml
# 把 101 改成 102 或 103
sudo netplan apply
```

修改主机名：

bash

```bash
sudo hostnamectl set-hostname slave1  # 或 slave2
```

## 快速检查清单：

执行以下命令确认都完成了：

bash

```bash
hostname          # 应输出 master
java -version     # 应输出 1.8.0_xxx
ip addr | grep inet  # 应看到 192.168.125.101
cat /etc/hosts    # 应看到 master/slave1/slave2
```

都确认无误后，就可以关机克隆了！