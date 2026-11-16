你在 NAT 模式下看到的 `virbr0` IP 是 `192.168.122.1`，而不是脚本中期望的 `192.168.17.1`，原因如下：

## 根本原因

**系统已经存在一个名为 `virbr0` 的网桥**（通常是 `libvirt` 安装后默认创建的 NAT 网桥），它的 IP 固定为 `192.168.122.1`。  
你的脚本 `/root/NAT/qemu-ifup` 中定义：
```bash
BRIDGE=virbr0
GATEWAY=192.168.17.1
```
但脚本中的 `check_bridge` 函数检测到 `virbr0` 已存在后，便**跳过了创建网桥和设置 IP 的步骤**（即没有执行 `create_bridge` 函数），直接复用了现有的 `virbr0`，因此它的 IP 仍然是原有的 `192.168.122.1`。

## 解决方案（任选一种）

### 方案一：修改脚本，使用另一个网桥名称（推荐）
例如将 `BRIDGE=virbr0` 改为 `BRIDGE=virbr1`，这样脚本会创建一个新的网桥，并设置 IP 为 `192.168.17.1`。

编辑 `/root/NAT/qemu-ifup`：
```bash
BRIDGE=virbr1          # 改为新名称
NETWORK=192.168.17.0
NETMASK=255.255.255.0
GATEWAY=192.168.17.1   # 保持不变
```

然后重启 QEMU。启动后 `brctl show` 会看到 `virbr1`，`ifconfig virbr1` 显示 `192.168.17.1`。

### 方案二：删除/禁用原有的 virbr0（如果你不需要 libvirt）
```bash
# 停止并删除默认 virbr0
virsh net-destroy default   # 如果 libvirt 服务在运行
virsh net-undefine default
systemctl stop libvirtd
# 或者直接手动删除网桥
ip link set virbr0 down
brctl delbr virbr0
```
之后再运行脚本，它会重新创建 `virbr0` 并设置成 `192.168.17.1`。

### 方案三：手动调整现有 virbr0 的 IP（不推荐，因为重启可能恢复）
```bash
ifconfig virbr0 192.168.17.1 netmask 255.255.255.0 up
```
然后重启 dnsmasq 监听新 IP，并修改 iptables 规则中的网段。较繁琐，不如直接换网桥名。

## 验证

修改后重新启动客户机，检查：
```bash
brctl show              # 应看到新网桥（如 virbr1）
ifconfig virbr1         # IP 应为 192.168.17.1
ps aux | grep dnsmasq   # 确认 --listen-address=192.168.17.1
```

客户机内执行 `ip addr`，应获得 `192.168.17.x` 的 IP，网关为 `192.168.17.1`。此时再测试 `ping 8.8.8.8` 和 `ping baidu.com` 应该正常。

如果仍有问题，请检查 iptables 规则中使用的网段是否为 `192.168.17.0/24`，必要时用 `iptables -t nat -L -n -v` 确认。